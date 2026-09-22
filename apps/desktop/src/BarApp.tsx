import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import type { UserPublic } from "@linvo/shared";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { EdgeHandle } from "@/components/edge-handle";
import { FloatingBar } from "@/components/floating-bar";
import {
  FloatingIslandShell,
  type FloatingIslandMode,
  type FloatingIslandMorph,
} from "@/components/floating-island-shell";
import { ProcedureChecklistPanel } from "@/components/procedure/procedure-checklist-panel";
import { IslandPanel } from "@/components/quick-center/island-panel";
import { useApiHealth } from "@/hooks/use-api-health";
import { useCompactClickThrough } from "@/hooks/use-compact-click-through";
import { useFloatingBootstrap } from "@/hooks/use-floating-bootstrap";
import { CAPTURE_AND_ASK_SHORTCUTS, useGlobalShortcut } from "@/hooks/use-global-shortcut";
import { useOverlayChrome } from "@/hooks/use-overlay-chrome";
import { useWindowPosition } from "@/hooks/use-window-position";
import { hideAllWindows, showMainBar } from "@/lib/app-windows";
import { rememberPreviousWindow } from "@/lib/focus-previous-window";
import { deriveIslandStatus } from "@/lib/island-status";
import {
  collapseChecklistToFloating,
  expandFloatingToChecklist,
} from "@/lib/floating-checklist-mode";
import { ensureCompactWindowBounds } from "@/lib/floating-compact-bounds";
import { collapseToEdge, expandFromEdge } from "@/lib/floating-edge-mode";
import { resetFloatingPosition } from "@/lib/floating-position-reset";
import {
  collapseQuickMenuToFloating,
  expandFloatingToQuickMenu,
} from "@/lib/floating-quick-menu-mode";
import {
  hasMeaningfulMorph,
  islandMorphSettleMs,
  ISLAND_MORPH_DURATION_MS,
  ISLAND_MORPH_WATCHDOG_MS,
  ISLAND_PAINT_WATCHDOG_MS,
  resolveEnvelopeMorphGeometry,
  type IslandMorphGeometry,
} from "@/lib/floating-island-transition";
import { setClickThrough } from "@/lib/overlay-chrome";
import { applyIslandEnvelopeRegion, applyIslandRegionForMode } from "@/lib/window-region";
import {
  CHECKLIST_SIZE,
  COMPACT_SIZE,
  QUICK_MENU_SIZE,
  type IslandEnvelopeMode,
  type IslandGrowthDirection,
} from "@/lib/window-mode";
import { ISLAND_PILL_POSITION_STORAGE_KEY } from "@/lib/window-storage";
import { NO_ANCHOR, type EdgeAnchor } from "@/lib/window-anchor";
import {
  emitChecklistClosed,
  emitChecklistProgress,
  listenChecklistDismiss,
  listenChecklistPayload,
  rememberChecklistConversation,
  type ChecklistWindowPayload,
} from "@/lib/checklist-window";
import {
  acceptAssistContinue,
  listenAssistContinue,
  rejectAssistContinue,
  type AssistContinueRequest,
} from "@/lib/assist-handoff";
import { PANEL_HOME_ROUTE } from "@/lib/panel-routes";
import { openPanel } from "@/lib/panel-window";
import { registerTrayHandlers } from "@/lib/system-tray";
import { createFloatingTrayHandlers } from "@/lib/tray-handlers";

type BarAppProps = {
  sessionWarning: string | null;
  user: UserPublic;
  /** Reauth compacto na ilha quando a sessão cai em floating (KAN-36). */
  onReauthenticate?: (password: string) => Promise<void>;
  onSignOut?: () => Promise<void>;
};

type WindowMode = FloatingIslandMode;
type CloseQuickMenuOptions = {
  restoreFocus?: boolean;
  preserveIntent?: boolean;
};
const QUICK_MENU_MIN_SIZE = { width: 320, height: 360 };

/**
 * Teto para o fecho inteiro do quick menu, derivado das esperas que ele
 * encadeia em vez de ser um número solto: dois `waitForIslandPaint` (cada um
 * limitado por `ISLAND_PAINT_WATCHDOG_MS`), o morph com o próprio watchdog, e
 * uma folga para o IPC nativo no meio.
 *
 * Escrito como soma dos limites reais porque já esteve fixo em 600ms e ficou
 * curto quando a duração do morph subiu — o fecho passava a estourar o
 * deadline e caía no caminho de recuperação (`ensureCompactWindowBounds`)
 * mesmo tendo funcionado.
 */
const QUICK_MENU_CLOSE_DEADLINE_MS =
  ISLAND_PAINT_WATCHDOG_MS * 2 +
  ISLAND_MORPH_DURATION_MS +
  ISLAND_MORPH_WATCHDOG_MS +
  200;

/**
 * Mesmo teto para a abertura. Um pouco mais folgado porque a abertura ainda
 * faz `show`/`unminimize`/`setFocus` antes do morph, e o custo disso depende
 * do estado da janela no sistema.
 */
const QUICK_MENU_OPEN_DEADLINE_MS = QUICK_MENU_CLOSE_DEADLINE_MS + 300;

/**
 * Desenho de cada modo. A janela é sempre `ISLAND_ENVELOPE_SIZE` nos modos
 * compact/quick-menu/checklist (ver `docs/SDD-ILHA-ENVELOPE.md`); só o
 * `edge-collapsed` ainda tem janela própria, do tamanho do handle.
 */
function visualSizeForMode(mode: WindowMode) {
  if (mode === "quick-menu") return QUICK_MENU_SIZE;
  if (mode === "checklist") return CHECKLIST_SIZE;
  return COMPACT_SIZE;
}

function sameChecklistProgress(
  left: ChecklistWindowPayload["progress"],
  right: ChecklistWindowPayload["progress"],
): boolean {
  return (
    left.currentStepIndex === right.currentStepIndex &&
    left.completedStepIndexes.length === right.completedStepIndexes.length &&
    left.completedStepIndexes.every(
      (value, index) => value === right.completedStepIndexes[index],
    )
  );
}

function visualWidthForMode(mode: WindowMode): number {
  return visualSizeForMode(mode).width;
}

async function withDeadline<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error("floating close timed out")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function BarApp({
  sessionWarning,
  user,
  onReauthenticate,
  onSignOut,
}: BarAppProps) {
  const { ready: floatingReady, growth } = useFloatingBootstrap();
  const apiHealthy = useApiHealth(true);
  /*
   * Checklist recolhido (KAN-38): a ilha volta à pílula mas o procedimento
   * continua aberto — progresso no badge, deskState intacto na conversa, e
   * um clique traz o checklist de volta. Só `handleChecklistClose` (o X)
   * encerra de verdade.
   */
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistWindowPayload | null>(
    null,
  );
  const [windowMode, setWindowMode] = useState<WindowMode>("compact");
  const [panelReady, setPanelReady] = useState(false);
  const [captureAndSendPending, setCaptureAndSendPending] = useState(false);
  const [quickMenuClosing, setQuickMenuClosing] = useState(false);
  const [edgeAnchor, setEdgeAnchor] = useState<EdgeAnchor>(NO_ANCHOR);
  const [transitioning, setTransitioning] = useState(false);
  const [islandMorph, setIslandMorph] = useState<FloatingIslandMorph | null>(
    null,
  );
  const windowModeRef = useRef(windowMode);
  const modeIntentRef = useRef<WindowMode>("compact");
  const transitionCountRef = useRef(0);
  const quickMenuCloseInFlightRef = useRef<Promise<void> | null>(null);
  const quickMenuCloseAttemptRef = useRef(0);
  const restoreChatFocusRef = useRef(false);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  const edgeHandleRef = useRef<HTMLButtonElement>(null);
  const openQuickMenuRef = useRef<() => Promise<void>>(async () => {});
  const expandFromEdgeRef = useRef<() => Promise<void>>(async () => {});
  const [continueRequest, setContinueRequest] =
    useState<AssistContinueRequest | null>(null);
  const islandMorphRef = useRef<FloatingIslandMorph | null>(null);
  const islandMorphIdRef = useRef(0);
  const islandMorphCompletionRef = useRef<{
    id: number;
    promise: Promise<void>;
    resolve: () => void;
    settled: boolean;
    timeoutId: number;
  } | null>(null);
  windowModeRef.current = windowMode;

  /**
   * Direção de crescimento do envelope (ver `docs/SDD-ILHA-ENVELOPE.md`),
   * usada por toda chamada nativa desta sessão. Resolvida uma vez no boot por
   * `enterFloatingMode`, e de novo sempre que a pílula pousa num lugar novo
   * (`resetFloatingPosition`, `expandFromEdge`) — nunca durante um morph.
   *
   * Vive em ref E em state, sempre gravados juntos por `applyGrowth`:
   *
   * - o ref é o que os fluxos assíncronos leem, síncrono, no meio de um await;
   * - o state é o que o render usa, porque o CSS PRECISA reagir à troca.
   *
   * Ler só o ref no render era um bug de tela preta: o recorte nativo
   * (`set_window_region`) usava "up" e o CSS seguia desenhando em "down", nos
   * lados opostos do envelope — o Windows expunha a faixa de baixo e o React
   * pintava a pílula em cima, então nada aparecia.
   *
   * O state não é derivado de `growth` (o valor do bootstrap) a cada render:
   * isso sobrescreveria uma atualização mais recente vinda daqueles dois
   * pontos com o valor congelado do boot. O efeito abaixo só propaga o valor
   * do bootstrap quando ele chega.
   */
  const [renderGrowth, setRenderGrowth] = useState<IslandGrowthDirection>(growth);
  const growthRef = useRef<IslandGrowthDirection>(growth);

  function applyGrowth(next: IslandGrowthDirection) {
    growthRef.current = next;
    setRenderGrowth(next);
  }

  useEffect(() => {
    applyGrowth(growth);
  }, [growth]);

  const islandStatus = deriveIslandStatus({
    floatingReady,
    apiHealthy,
    sessionWarning,
  });
  const captureAndAskRef = useRef<() => void>(() => undefined);
  const passthroughSuspended =
    transitioning || Boolean(islandMorph && !islandMorph.settled);

  useOverlayChrome(floatingReady);
  useCompactClickThrough({
    mode: windowMode,
    suspended: passthroughSuspended,
  });
  useGlobalShortcut({
    shortcuts: CAPTURE_AND_ASK_SHORTCUTS,
    onTrigger: () => {
      captureAndAskRef.current();
    },
  });

  function startTransition() {
    transitionCountRef.current += 1;
    if (transitionCountRef.current === 1) {
      setTransitioning(true);
    }
  }

  function finishTransition() {
    transitionCountRef.current = Math.max(0, transitionCountRef.current - 1);
    if (transitionCountRef.current === 0) {
      setTransitioning(false);
    }
  }

  /**
   * Resolve uma conclusão pendente e cancela o watchdog dela.
   *
   * Toda saída do fluxo do morph passa por aqui: enquanto uma conclusão ficar
   * pendente, existe um `await waitForIslandMorph()` preso a ela, e um
   * `finishTransition()` que nunca roda atrás dele.
   */
  function settleCompletion(
    completion: typeof islandMorphCompletionRef.current,
  ) {
    if (!completion || completion.settled) {
      return;
    }
    completion.settled = true;
    window.clearTimeout(completion.timeoutId);
    completion.resolve();
  }

  function clearIslandMorph() {
    settleCompletion(islandMorphCompletionRef.current);
    islandMorphRef.current = null;
    islandMorphCompletionRef.current = null;
    setIslandMorph(null);
  }

  function waitForIslandPaint(): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let firstFrame = 0;
      let secondFrame = 0;

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
        resolve();
      };

      const timeoutId = window.setTimeout(finish, ISLAND_PAINT_WATCHDOG_MS);
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(finish);
      });
    });
  }

  function settleIslandMorph(nextMode: WindowMode, options?: { panelReady?: boolean }) {
    flushSync(() => {
      setWindowMode(nextMode);
      if (options?.panelReady) {
        setPanelReady(true);
      }
      const current = islandMorphRef.current;
      if (!current) {
        return;
      }
      const settled: FloatingIslandMorph = {
        ...current,
        active: false,
        settled: true,
      };
      islandMorphRef.current = settled;
      setIslandMorph(settled);
    });
  }

  async function prepareIslandMorph(
    geometry: IslandMorphGeometry,
    fromMode: WindowMode,
    toMode: WindowMode,
  ) {
    if (islandMorphRef.current?.settled) {
      clearIslandMorph();
    }

    if (!hasMeaningfulMorph(geometry)) {
      clearIslandMorph();
      return;
    }

    const nextMorph: FloatingIslandMorph = {
      id: ++islandMorphIdRef.current,
      active: false,
      fromMode,
      toMode,
      geometry,
    };
    islandMorphRef.current = nextMorph;
    setIslandMorph(nextMorph);

    /*
     * O estado inicial precisa estar pintado antes de ativar, senão o browser
     * junta os dois commits e não sobra transição para animar.
     */
    await waitForIslandPaint();
  }

  function startIslandMorph(): Promise<void> {
    const current = islandMorphRef.current;
    if (!current) {
      return Promise.resolve();
    }

    /*
     * Libera quem já espera pela conclusão ANTERIOR antes de trocar o ref.
     *
     * `completeIslandMorph` só resolve a conclusão que ainda está no ref (ela
     * compara o id). Substituir sem liberar deixava a promise antiga pendente
     * para sempre: o watchdog dela disparava, via um id diferente no ref e
     * saía sem resolver. Quem estava em `await waitForIslandMorph()` — ou
     * seja, uma abertura em curso — travava, o `finally` com
     * `finishTransition()` nunca rodava, e `transitionCountRef` ficava acima
     * de zero. A partir daí toda abertura seguinte retornava na primeira
     * linha: o chat parava de abrir de vez.
     */
    settleCompletion(islandMorphCompletionRef.current);

    let resolveCompletion = () => {};
    const promise = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const completion = {
      id: current.id,
      promise,
      resolve: resolveCompletion,
      settled: false,
      timeoutId: 0,
    };
    /*
     * Mesmo raciocínio do watchdog do shell: dimensionado pela ACOMODAÇÃO da
     * mola, não pela duração visual. Este aqui é o que resolve
     * `waitForIslandMorph`, então disparar cedo não só corta a animação —
     * dispara o encolhimento da região nativa com a forma ainda em movimento.
     */
    completion.timeoutId = window.setTimeout(
      () => completeIslandMorph(current.id),
      islandMorphSettleMs(current.fromMode === "compact") +
        ISLAND_MORPH_WATCHDOG_MS,
    );
    islandMorphCompletionRef.current = completion;

    const activeMorph = { ...current, active: true };
    islandMorphRef.current = activeMorph;
    setIslandMorph(activeMorph);
    return promise;
  }

  function completeIslandMorph(id: number) {
    const completion = islandMorphCompletionRef.current;
    if (completion?.id !== id) {
      return;
    }
    settleCompletion(completion);
  }

  async function waitForIslandMorph() {
    await islandMorphCompletionRef.current?.promise;
  }

  /** Região de repouso do modo assentado, aplicada depois do morph acabar. */
  async function applySettledRegion(mode: IslandEnvelopeMode) {
    try {
      const win = getCurrentWindow();
      const scale = await win.scaleFactor();
      await applyIslandRegionForMode({
        mode,
        growth: growthRef.current,
        scaleFactor: scale,
      });
    } catch {
      // Perder o recorte piora a área clicável, mas não justifica travar a
      // transição que já assentou.
    }
  }

  useWindowPosition({
    enabled:
      floatingReady &&
      (windowMode === "compact" || windowMode === "quick-menu") &&
      !transitioning,
    shouldPersist: () =>
      windowModeRef.current === "compact" ||
      windowModeRef.current === "quick-menu",
    storageKey: ISLAND_PILL_POSITION_STORAGE_KEY,
    pillGrowth: () => growthRef.current,
  });

  useEffect(() => {
    let unlistenPayload: (() => void) | undefined;
    let unlistenDismiss: (() => void) | undefined;
    let cancelled = false;

    void listenChecklistPayload(async (payload) => {
      if (cancelled) return;
      modeIntentRef.current = "checklist";
      startTransition();
      try {
        if (windowModeRef.current === "quick-menu") {
          setPanelReady(false);
          await closeQuickMenu({
            restoreFocus: false,
            preserveIntent: true,
          });
        } else if (windowModeRef.current === "edge-collapsed") {
          applyGrowth(await expandFromEdge());
        }
        if (cancelled || modeIntentRef.current !== "checklist") return;
        setChecklist(payload);
        setChecklistCollapsed(false);
        await morphCompactToChecklist(() => cancelled);
      } finally {
        if (!cancelled) {
          finishTransition();
        }
      }
    }).then((dispose) => {
      unlistenPayload = dispose;
    });

    void listenChecklistDismiss(() => {
      if (cancelled) return;
      rememberChecklistConversation(null);
      // Recolhido: a ilha já é pílula, não há morph a desfazer.
      if (windowModeRef.current !== "checklist") {
        setChecklist(null);
        setChecklistCollapsed(false);
        return;
      }
      modeIntentRef.current = "compact";
      startTransition();
      (async () => {
        try {
          const geometry = resolveEnvelopeMorphGeometry({
            fromMode: "checklist",
            toMode: "compact",
            growth: growthRef.current,
          });
          await prepareIslandMorph(geometry, "checklist", "compact");
          await collapseChecklistToFloating(growthRef.current);
          if (!cancelled && modeIntentRef.current === "compact") {
            void startIslandMorph();
          }
          await waitForIslandMorph();
          if (!cancelled && modeIntentRef.current === "compact") {
            await waitForIslandPaint();
            settleIslandMorph("compact");
            // Sem espera extra aqui — ver o comentário em listenChecklistPayload.
            await applySettledRegion("compact");
            setChecklist(null);
          }
        } catch {
          if (modeIntentRef.current === "compact") {
            modeIntentRef.current = "checklist";
          }
          clearIslandMorph();
        } finally {
          if (!cancelled) {
            finishTransition();
          }
        }
      })();
    }).then((dispose) => {
      unlistenDismiss = dispose;
    });

    return () => {
      cancelled = true;
      unlistenPayload?.();
      unlistenDismiss?.();
    };
  }, []);

  /*
   * Compacta → checklist. Compartilhado pelo payload novo e pelo "voltar ao
   * checklist" do badge; quem chama já fez `startTransition` e é dono do
   * `finishTransition`.
   */
  async function morphCompactToChecklist(
    isCancelled: () => boolean = () => false,
  ) {
    const geometry = resolveEnvelopeMorphGeometry({
      fromMode: "compact",
      toMode: "checklist",
      growth: growthRef.current,
    });
    await prepareIslandMorph(geometry, "compact", "checklist");
    await expandFloatingToChecklist(growthRef.current);
    if (!isCancelled() && modeIntentRef.current === "checklist") {
      void startIslandMorph();
    }
    await waitForIslandMorph();
    if (!isCancelled() && modeIntentRef.current === "checklist") {
      await waitForIslandPaint();
      settleIslandMorph("checklist");
      /*
       * Sem espera aqui: `settleIslandMorph` já comitou via `flushSync`, e
       * o quadro assentado é visualmente idêntico ao último quadro do
       * morph (mesma posição/tamanho, só a metadata muda). Esperar mais um
       * paint antes de encolher a região não evita nada — só atrasa o
       * encolhimento, e esse atraso pode ficar bem maior que o esperado
       * quando a janela está sem foco (rAF/timeout são acelerados para
       * baixo pelo navegador): era esse atraso que deixava uma tira maior
       * que a pílula recortada, mostrando o branco padrão do documento.
       */
      await applySettledRegion("checklist");
    }
  }

  /*
   * Checklist → compacta. `keepChecklist` distingue recolher (KAN-38: o
   * procedimento continua aberto, só some da tela) de fechar.
   */
  async function morphChecklistToCompact(keepChecklist: boolean) {
    modeIntentRef.current = "compact";
    startTransition();
    try {
      const geometry = resolveEnvelopeMorphGeometry({
        fromMode: "checklist",
        toMode: "compact",
        growth: growthRef.current,
      });
      await prepareIslandMorph(geometry, "checklist", "compact");
      await collapseChecklistToFloating(growthRef.current);
      if (modeIntentRef.current === "compact") {
        void startIslandMorph();
      }
      await waitForIslandMorph();
      if (modeIntentRef.current === "compact") {
        await waitForIslandPaint();
        settleIslandMorph("compact");
        // Sem espera extra aqui — ver o comentário em morphCompactToChecklist.
        await applySettledRegion("compact");
        restoreChatFocusRef.current = true;
        if (!keepChecklist) {
          setChecklist(null);
        }
      }
    } catch {
      if (modeIntentRef.current === "compact") {
        modeIntentRef.current = "checklist";
      }
      setChecklistCollapsed(false);
      clearIslandMorph();
    } finally {
      finishTransition();
    }
  }

  async function handleChecklistClose() {
    const conversationId = checklist?.conversationId ?? null;
    rememberChecklistConversation(null);
    setChecklistCollapsed(false);
    if (conversationId) {
      await emitChecklistClosed({ conversationId });
    }
    await morphChecklistToCompact(false);
  }

  async function handleChecklistCollapse() {
    if (windowModeRef.current !== "checklist" || transitionCountRef.current > 0) {
      return;
    }
    setChecklistCollapsed(true);
    await morphChecklistToCompact(true);
  }

  async function handleResumeChecklist() {
    if (
      !checklist ||
      windowModeRef.current !== "compact" ||
      transitionCountRef.current > 0
    ) {
      return;
    }
    modeIntentRef.current = "checklist";
    setChecklistCollapsed(false);
    startTransition();
    try {
      await morphCompactToChecklist();
    } catch {
      if (modeIntentRef.current === "checklist") {
        modeIntentRef.current = "compact";
      }
      setChecklistCollapsed(true);
      clearIslandMorph();
    } finally {
      finishTransition();
    }
  }

  async function handleOpenQuickMenu() {
    if (
      windowModeRef.current !== "compact" ||
      transitionCountRef.current > 0
    ) {
      return;
    }
    modeIntentRef.current = "quick-menu";
    startTransition();
    try {
      /*
       * A abertura inteira é limitada por prazo, como o fecho.
       *
       * `finishTransition()` só roda no `finally`, e enquanto ele não roda
       * `transitionCountRef` fica acima de zero — o que faz TODA abertura
       * seguinte retornar na primeira linha desta função. Ou seja: um único
       * `await` que não resolva aqui não atrasa uma abertura, mata o botão de
       * chat pelo resto da sessão. O prazo transforma esse modo de falha
       * permanente numa falha de uma vez só, que ainda cai no `catch` e
       * reconcilia a janela.
       */
      await withDeadline(
        (async () => {
          /*
           * Geometria é pura (não depende de bounds nativos) — prepara o morph
           * no MESMO tick de `setWindowMode`, antes de qualquer IPC. Sem isso o
           * shell via `mode` já em "quick-menu" mas `morph` ainda nulo, mostrava
           * o painel inteiro (recortado pela região ainda compacta) por um
           * instante antes do morph existir — um flash que desaparecia de novo
           * assim que `prepareIslandMorph` assumia o controle da exibição.
           *
           * O painel precisa existir enquanto a expansão corre, senão um fecho
           * disparado no meio da transição não encontra nada para fechar.
           * `panelReady` continua falso até o morph assentar, então ele ainda
           * não aparece — só existe.
           */
          const geometry = resolveEnvelopeMorphGeometry({
            fromMode: "compact",
            toMode: "quick-menu",
            growth: growthRef.current,
          });
          setWindowMode("quick-menu");
          setPanelReady(false);
          await prepareIslandMorph(geometry, "compact", "quick-menu");
          await expandFloatingToQuickMenu(growthRef.current);
          /*
           * Reconfere antes de disparar a animação: um fecho pode ter superado
           * esta abertura enquanto a chamada nativa corria (`modeIntentRef` já
           * virou "compact" nesse caso, e possivelmente já assentou seu próprio
           * morph). Disparar aqui sem checar reativaria esse morph assentado.
           */
          if (modeIntentRef.current === "quick-menu") {
            void startIslandMorph();
          }
          await waitForIslandMorph();
          if (modeIntentRef.current !== "quick-menu") {
            setCaptureAndSendPending(false);
            return;
          }
          await waitForIslandPaint();
          /*
           * Reconfere depois do await: um fecho disparado enquanto ele corria
           * já trocou a intenção para "compact" e devolveu a janela ao estado
           * compacto. Assentar aqui reescreveria o modo e o painel voltaria.
           */
          if (modeIntentRef.current !== "quick-menu") {
            setCaptureAndSendPending(false);
            return;
          }
          settleIslandMorph("quick-menu", { panelReady: true });
          // Sem espera extra aqui — ver o comentário em listenChecklistPayload.
          await applySettledRegion("quick-menu");
        })(),
        QUICK_MENU_OPEN_DEADLINE_MS,
      );
    } catch {
      if (modeIntentRef.current === "quick-menu") {
        modeIntentRef.current = "compact";
        setPanelReady(false);
        setWindowMode("compact");
        setCaptureAndSendPending(false);
      }
      clearIslandMorph();
      void ensureCompactWindowBounds(growthRef.current).catch(() => undefined);
    } finally {
      finishTransition();
    }
  }

  openQuickMenuRef.current = handleOpenQuickMenu;

  useEffect(() => {
    const handlers = createFloatingTrayHandlers({
      expandAssist: async () => {
        await showMainBar();
        await openQuickMenuRef.current();
      },
      openWorkspace: async () => {
        await openPanel(PANEL_HOME_ROUTE);
      },
    });
    registerTrayHandlers({
      openChat: handlers.openChat,
      openWorkspace: handlers.openWorkspace,
    });
  }, []);

  async function handleCaptureContext() {
    if (transitionCountRef.current > 0) {
      return;
    }
    if (windowModeRef.current === "checklist") {
      return;
    }
    void rememberPreviousWindow();
    setCaptureAndSendPending(true);
    await showMainBar();
    if (windowModeRef.current === "compact") {
      await handleOpenQuickMenu();
    }
  }

  captureAndAskRef.current = () => {
    void handleCaptureContext();
  };

  /*
   * "Continuar no Assist" vindo do Histórico do painel. Mesmo caminho do
   * atalho de captura: mostra a barra e expande se estiver compacta. Em modo
   * checklist não interrompe — o atendente está no meio de um procedimento.
   */
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenAssistContinue((payload) => {
      const { conversationId } = payload;
      if (windowModeRef.current === "checklist") {
        void rejectAssistContinue(payload, "checklist");
        return;
      }
      setContinueRequest((previous) => ({
        conversationId,
        token: (previous?.token ?? 0) + 1,
      }));
      void (async () => {
        await acceptAssistContinue(payload);
        await showMainBar();
        if (windowModeRef.current === "edge-collapsed") {
          await expandFromEdgeRef.current();
        }
        if (windowModeRef.current === "compact") {
          await openQuickMenuRef.current();
        }
      })();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  async function closeQuickMenu(
    options: CloseQuickMenuOptions = {},
  ): Promise<void> {
    const quickMenuIsVisibleOrTransitioning =
      windowModeRef.current === "quick-menu" ||
      modeIntentRef.current === "quick-menu";

    if (
      !options.preserveIntent &&
      modeIntentRef.current === "quick-menu"
    ) {
      modeIntentRef.current = "compact";
    }

    if (
      !quickMenuIsVisibleOrTransitioning &&
      !quickMenuCloseInFlightRef.current
    ) {
      return;
    }

    if (options.restoreFocus ?? true) {
      restoreChatFocusRef.current = true;
    }

    if (quickMenuCloseInFlightRef.current) {
      return quickMenuCloseInFlightRef.current;
    }

    startTransition();
    const closeAttempt = ++quickMenuCloseAttemptRef.current;
    const isCurrentAttempt = () => quickMenuCloseAttemptRef.current === closeAttempt;
    const closeTask = (async () => {
      try {
        setQuickMenuClosing(true);
        setPanelReady(false);
        await withDeadline(
          (async () => {
            /*
             * Sem foco, não anima: assenta direto.
             *
             * O morph é conduzido pelo Motion, que roda em
             * `requestAnimationFrame` no main thread — e o Chromium estrangula
             * o rAF de uma janela sem foco. Animar nesse estado congela a mola
             * no primeiro quadro: `onAnimationComplete` nunca chega e o fecho
             * estoura o deadline. (A transição CSS anterior ao Motion não
             * tinha o problema: `transform`/`opacity` animam no compositor,
             * que segue avançando sem foco.)
             *
             * O fecho por blur, que era o caso óbvio disto, já não existe. O
             * guard fica para os fechos disparados por EVENTO, que podem
             * chegar com a janela em segundo plano — hoje o payload de
             * checklist, que fecha o quick menu antes de assumir a ilha.
             *
             * Pular a animação aqui não perde nada: a janela está sem foco,
             * ninguém está olhando, e o que importa é o painel sumir. É a
             * mesma razão pela qual `--reduce-motion` também assenta na hora.
             */
            if (!document.hasFocus()) {
              clearIslandMorph();
              if (isCurrentAttempt() && modeIntentRef.current === "compact") {
                setWindowMode("compact");
                await applySettledRegion("compact");
              }
              return;
            }

            const geometry = resolveEnvelopeMorphGeometry({
              fromMode: "quick-menu",
              toMode: "compact",
              growth: growthRef.current,
            });
            if (isCurrentAttempt()) {
              await prepareIslandMorph(geometry, "quick-menu", "compact");
            }
            await collapseQuickMenuToFloating(growthRef.current);
            if (isCurrentAttempt()) {
              void startIslandMorph();
            }
            await waitForIslandMorph();
            if (isCurrentAttempt() && modeIntentRef.current === "compact") {
              await waitForIslandPaint();
              settleIslandMorph("compact");
              // Sem espera extra aqui — ver o comentário em listenChecklistPayload.
              await applySettledRegion("compact");
            }
          })(),
          QUICK_MENU_CLOSE_DEADLINE_MS,
        );
      } catch {
        if (isCurrentAttempt()) {
          quickMenuCloseAttemptRef.current += 1;
        }
        void ensureCompactWindowBounds(growthRef.current).catch(() => undefined);
      } finally {
        if (isCurrentAttempt()) {
          quickMenuCloseAttemptRef.current += 1;
        }
        if (windowModeRef.current !== "compact") {
          setWindowMode("compact");
        }
        clearIslandMorph();
        setPanelReady(false);
        setCaptureAndSendPending(false);
        setQuickMenuClosing(false);
      }
    })();
    quickMenuCloseInFlightRef.current = closeTask;

    try {
      await closeTask;
    } finally {
      quickMenuCloseInFlightRef.current = null;
      finishTransition();
    }
  }

  async function handleCollapseToEdge() {
    modeIntentRef.current = "edge-collapsed";
    startTransition();
    try {
      const anchor = await collapseToEdge(growthRef.current);
      if (!anchor) {
        if (modeIntentRef.current === "edge-collapsed") {
          modeIntentRef.current = "compact";
        }
        return;
      }
      if (modeIntentRef.current !== "edge-collapsed") {
        return;
      }
      setEdgeAnchor(anchor);
      setWindowMode("edge-collapsed");
    } finally {
      finishTransition();
    }
  }

  async function handleExpandFromEdge() {
    modeIntentRef.current = "compact";
    startTransition();
    try {
      applyGrowth(await expandFromEdge());
      if (modeIntentRef.current === "compact") {
        restoreChatFocusRef.current = true;
        windowModeRef.current = "compact";
        setWindowMode("compact");
      }
    } finally {
      finishTransition();
    }
  }

  expandFromEdgeRef.current = handleExpandFromEdge;

  async function handleHideQuickMenu() {
    await closeQuickMenu({ restoreFocus: false });
    /*
     * Esconder a janela ainda expandida a traz de volta expandida na próxima
     * vez, com a pílula desenhada dentro dela — daí a reconciliação aqui, mesmo
     * quando o fecho acima já pareceu bem-sucedido. É no-op se já está compacta.
     */
    modeIntentRef.current = "compact";
    await ensureCompactWindowBounds(growthRef.current).catch(() => undefined);
    setPanelReady(false);
    setWindowMode("compact");
    await hideAllWindows();
  }

  async function handleResetPosition() {
    if (windowModeRef.current !== "compact") {
      return;
    }
    flushSync(() => {
      startTransition();
    });
    await setClickThrough({ enabled: false, holes: [] });
    try {
      const resolvedGrowth = await resetFloatingPosition();
      if (resolvedGrowth) {
        applyGrowth(resolvedGrowth);
      }
      setEdgeAnchor(NO_ANCHOR);
    } finally {
      finishTransition();
    }
  }

  useEffect(() => {
    if (windowMode !== "compact" || !restoreChatFocusRef.current) {
      return;
    }
    restoreChatFocusRef.current = false;
    chatButtonRef.current?.focus();
  }, [windowMode]);

  /*
   * Foca o handle ao encolher. É a única saída por teclado do modo encolhido:
   * `Ctrl+Shift+L` só alterna visibilidade, então sem isso um usuário de teclado
   * fica preso na tira. A ilha passou a aparecer sem ativar (KAN-10), então o
   * foco de DOM aqui só resolve porque o caminho do atalho global pede
   * `toggleAppVisibility({ focus: true })` — tray e restore continuam sem ativar.
   */
  useEffect(() => {
    if (windowMode !== "edge-collapsed") {
      return;
    }
    edgeHandleRef.current?.focus();
  }, [windowMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void handleCaptureContext();
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        if (windowModeRef.current === "quick-menu") {
          void closeQuickMenu({ restoreFocus: true });
          return;
        }
        if (windowModeRef.current === "compact") {
          void handleOpenQuickMenu();
        }
        return;
      }

      if (event.key === "Enter" && windowModeRef.current === "compact") {
        const target = event.target as HTMLElement | null;
        if (
          target?.closest(
            "button, input, textarea, select, [contenteditable='true']",
          )
        ) {
          return;
        }
        event.preventDefault();
        void handleOpenQuickMenu();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  /*
   * A região é recortada em pixels físicos, derivados da escala do monitor onde
   * a janela estava quando foi aplicada. Com dois monitores de DPI diferente, ao
   * arrastar a janela o Windows a redimensiona para o novo DPI e a região antiga
   * passa a ser menor que a janela — a pílula aparece cortada. Reaplicar no
   * evento de escala realinha os dois.
   */
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onScaleChanged(({ payload }) => {
        const mode = windowModeRef.current;
        const scale = payload.scaleFactor;
        if (mode === "edge-collapsed") {
          // Handle é a janela inteira, sem o envelope por baixo: recorta o
          // próprio tamanho atual, sem offset — mesma lógica de `collapseToEdge`.
          void getCurrentWindow()
            .outerSize()
            .then((size) =>
              applyIslandEnvelopeRegion({
                rect: { x: 0, y: 0, width: size.width / scale, height: size.height / scale },
                scaleFactor: scale,
                radius: 0,
              }),
            )
            .catch(() => undefined);
          return;
        }
        void applyIslandRegionForMode({
          mode,
          growth: growthRef.current,
          scaleFactor: scale,
        }).catch(() => undefined);
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
        } else {
          unlisten = dispose;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  /*
   * O quick menu NÃO fecha ao perder o foco. Fecha pelo X, por `Esc`, ou por
   * `Ctrl+Shift+L` — todos com a janela focada.
   *
   * O fecho por blur existia e foi removido: ele era a única via que rodava o
   * morph com a janela já sem foco, e o Motion anima em `requestAnimationFrame`,
   * que o Chromium estrangula justamente nesse estado. A mola congelava no
   * primeiro quadro, `onAnimationComplete` nunca chegava, o fecho estourava o
   * deadline e caía na recuperação — na prática, travava. Também é o mesmo
   * caminho que já tinha produzido a "barra branca" antes do Motion, pela
   * mesma raiz de throttling.
   *
   * Com ele fora, some junto toda a maquinaria que existia só para silenciá-lo
   * em falsos positivos: a trava durante a captura de contexto (o seletor do
   * sistema é uma janela nativa e roubava o foco) e a folga durante o arraste
   * do painel.
   */

  useEffect(() => {
    if (transitioning || (islandMorph && !islandMorph.settled)) {
      return;
    }

    let cancelled = false;
    const win = getCurrentWindow();

    async function syncResizePolicy() {
      if (windowMode === "quick-menu") {
        const scale = await win.scaleFactor();
        if (cancelled) return;
        await win.setResizable(true);
        await win.setMaximizable(false);
        if (cancelled) return;
        // Tolerante por si só: perder o mínimo só afeta o quanto o painel
        // encolhe no arraste, e não vale derrubar o resto da política.
        await win
          .setMinSize(
            new PhysicalSize(
              Math.ceil(QUICK_MENU_MIN_SIZE.width * scale),
              Math.ceil(QUICK_MENU_MIN_SIZE.height * scale),
            ),
          )
          .catch(() => undefined);
        return;
      }

      if (windowMode === "edge-collapsed") {
        return;
      }

      await win.setResizable(false);
      await win.setMaximizable(false);
    }

    void syncResizePolicy();

    return () => {
      cancelled = true;
    };
  }, [windowMode, transitioning, islandMorph]);

  /*
   * Rede de segurança do morph: só o edge mode ainda move a janela de verdade
   * (compact/quick-menu/checklist ficam sempre no tamanho do envelope, ver
   * `docs/SDD-ILHA-ENVELOPE.md`). Todo caminho que aborta no meio de um
   * encolhimento de borda (deadline de fecho estourado, erro de IPC) pode
   * deixar a janela do tamanho do handle em vez do envelope. Em vez de tapar
   * cada buraco desses, o estado compacto é reconciliado sempre que assenta.
   */
  useEffect(() => {
    if (
      !floatingReady ||
      windowMode !== "compact" ||
      transitioning ||
      (islandMorph && !islandMorph.settled)
    ) {
      return;
    }

    void ensureCompactWindowBounds(growthRef.current, {
      shouldApply: () =>
        windowModeRef.current === "compact" &&
        modeIntentRef.current === "compact" &&
        transitionCountRef.current === 0,
    }).catch(() => undefined);
  }, [floatingReady, windowMode, transitioning, islandMorph]);

  function renderIslandMode(mode: WindowMode) {
    if (mode === "checklist") {
      if (!checklist) return null;
      return (
        <ProcedureChecklistPanel
          key={`${checklist.conversationId}-${checklist.procedure.id}`}
          title={
            checklist.procedure.title?.trim() ||
            checklist.procedure.slug ||
            "Procedure"
          }
          slug={checklist.procedure.slug ?? ""}
          steps={checklist.procedure.steps ?? []}
          initialCompleted={checklist.progress.completedStepIndexes}
          onProgressChange={(progress) => {
            /*
             * Guarda aqui também: é o que o badge "2/5" e o remount pós-
             * recolher leem — o evento sozinho só chega às outras janelas.
             * Só grava quando mudou de fato: o painel reemite a cada render
             * (o callback é inline), e um objeto novo por render viraria um
             * loop de renderização.
             */
            setChecklist((current) =>
              current &&
              current.conversationId === checklist.conversationId &&
              !sameChecklistProgress(current.progress, progress)
                ? { ...current, progress }
                : current,
            );
            void emitChecklistProgress({
              conversationId: checklist.conversationId,
              progress,
            });
          }}
          onClose={() => void handleChecklistClose()}
          onCollapse={() => void handleChecklistCollapse()}
        />
      );
    }

    if (mode === "quick-menu") {
      return (
        <IslandPanel
          user={user}
          apiHealthy={apiHealthy}
          sessionWarning={sessionWarning}
          ready={panelReady}
          closing={quickMenuClosing}
          captureRequested={captureAndSendPending}
          onCaptureRequestConsumed={() => setCaptureAndSendPending(false)}
          onClose={() => void closeQuickMenu()}
          onHide={() => void handleHideQuickMenu()}
          continueRequest={continueRequest}
          reauth={
            sessionWarning && onReauthenticate && onSignOut
              ? { email: user.email, onSubmit: onReauthenticate, onSignOut }
              : null
          }
        />
      );
    }

    if (mode === "edge-collapsed") {
      return (
        <EdgeHandle
          anchor={edgeAnchor}
          status={islandStatus}
          onExpand={() => void handleExpandFromEdge()}
          buttonRef={edgeHandleRef}
        />
      );
    }

    return (
      <FloatingBar
        status={islandStatus}
        onOpenQuickMenu={() => void handleOpenQuickMenu()}
        onCaptureContext={() => void handleCaptureContext()}
        onCollapseToEdge={() => void handleCollapseToEdge()}
        onResetPosition={() => void handleResetPosition()}
        chatButtonRef={chatButtonRef}
        checklist={
          checklist && checklistCollapsed
            ? {
                title:
                  checklist.procedure.title?.trim() ||
                  checklist.procedure.slug ||
                  "Procedure",
                completed: checklist.progress.completedStepIndexes.length,
                total: checklist.procedure.steps?.length ?? 0,
              }
            : null
        }
        onResumeChecklist={() => void handleResumeChecklist()}
      />
    );
  }

  return (
    <FloatingIslandShell
      mode={windowMode}
      morph={islandMorph}
      renderMode={renderIslandMode}
      onMorphComplete={completeIslandMorph}
      visualWidth={visualWidthForMode(windowMode)}
      growth={renderGrowth}
    />
  );
}
