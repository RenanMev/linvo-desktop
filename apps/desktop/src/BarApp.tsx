import type { UserPublic } from "@linvo/shared";
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
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
import { QuickCenterPanel } from "@/components/quick-center/quick-center-panel";
import { useApiHealth } from "@/hooks/use-api-health";
import { useFloatingBootstrap } from "@/hooks/use-floating-bootstrap";
import { useWindowPosition } from "@/hooks/use-window-position";
import { hideAllWindows } from "@/lib/app-windows";
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
  ISLAND_EXPANDED_RADIUS_PX,
  ISLAND_MORPH_DURATION_MS,
  ISLAND_MORPH_WATCHDOG_MS,
  ISLAND_PAINT_WATCHDOG_MS,
  type IslandMorphGeometry,
} from "@/lib/floating-island-transition";
import { applyIslandWindowRegion } from "@/lib/window-region";
import { islandLog, sampleViewportFrames } from "@/lib/island-debug";
import {
  CHECKLIST_SIZE,
  COMPACT_SIZE,
  QUICK_MENU_SIZE,
} from "@/lib/window-mode";
import { releaseMinWindowSize } from "@/lib/window-animation";
import { NO_ANCHOR, type EdgeAnchor } from "@/lib/window-anchor";
import {
  emitChecklistClosed,
  emitChecklistProgress,
  listenChecklistDismiss,
  listenChecklistPayload,
  rememberChecklistConversation,
  type ChecklistWindowPayload,
} from "@/lib/checklist-window";

type BarAppProps = {
  sessionWarning: string | null;
  user: UserPublic;
};

type WindowMode = FloatingIslandMode;
type CloseQuickMenuOptions = {
  restoreFocus?: boolean;
  preserveIntent?: boolean;
};
const QUICK_MENU_MIN_SIZE = { width: 320, height: 360 };
const QUICK_MENU_CLOSE_DEADLINE_MS = 600;

/**
 * Desenho de cada modo. A janela é sempre `ISLAND_WINDOW_WIDTH` de largura; é
 * isto que mantém a pílula com 168px em vez de esticar até a borda.
 */
function visualSizeForMode(mode: WindowMode) {
  if (mode === "quick-menu") return QUICK_MENU_SIZE;
  if (mode === "checklist") return CHECKLIST_SIZE;
  return COMPACT_SIZE;
}

function visualWidthForMode(mode: WindowMode): number {
  return visualSizeForMode(mode).width;
}

/** Pílula é totalmente arredondada; painéis usam o raio da ilha. */
function visualRadiusForMode(mode: WindowMode): number {
  return isCompactMode(mode)
    ? visualSizeForMode(mode).height / 2
    : ISLAND_EXPANDED_RADIUS_PX;
}

function isCompactMode(mode: WindowMode): boolean {
  return mode === "compact" || mode === "edge-collapsed";
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

export function BarApp({ sessionWarning, user }: BarAppProps) {
  const floatingReady = useFloatingBootstrap();
  const apiHealthy = useApiHealth(true);
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
  const suppressBlurCloseUntilRef = useRef(0);
  const captureActiveRef = useRef(false);
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

  const isActive = floatingReady && apiHealthy && !sessionWarning;

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

  function clearIslandMorph() {
    const completion = islandMorphCompletionRef.current;
    if (completion && !completion.settled) {
      completion.settled = true;
      window.clearTimeout(completion.timeoutId);
      completion.resolve();
    }
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

  /*
   * A promise do `set_window_bounds` confirma o SetWindowPos, mas o WebView2
   * ainda pode estar com o layout do viewport anterior. Esperar o `resize` e
   * dois frames depois dele separa o commit nativo da primeira mudança de
   * transform/opacity do CSS. Sem essa barreira os dois commits podem cair no
   * mesmo frame e a janela transparente revela o desktop por um instante.
   */
  function waitForIslandViewportPaint(
    geometry: IslandMorphGeometry,
  ): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let firstFrame = 0;
      let secondFrame = 0;
      let framesQueued = false;

      const matchesTargetViewport = () =>
        Math.abs(window.innerWidth - geometry.viewport.width) <= 1 &&
        Math.abs(window.innerHeight - geometry.viewport.height) <= 1;

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
        window.removeEventListener("resize", onResize);
        resolve();
      };

      /*
       * Um frame só, não dois.
       *
       * O segundo `requestAnimationFrame` custava 18-85ms medidos (frames caem
       * enquanto o WebView refaz o layout do painel), e nesse intervalo a janela
       * já está expandida com só a pílula pintada e parada — o desktop aparece
       * em volta antes de a animação sequer começar. Um frame basta para o
       * commit nativo não coalescer com a primeira mudança de transform.
       */
      const queuePaintFrames = () => {
        if (framesQueued || !matchesTargetViewport()) return;
        framesQueued = true;
        firstFrame = window.requestAnimationFrame(finish);
      };

      const onResize = () => {
        queuePaintFrames();
      };

      const timeoutId = window.setTimeout(() => {
        islandLog("viewport-paint:WATCHDOG-EXPIRED", {
          wanted: geometry.viewport,
          got: { w: window.innerWidth, h: window.innerHeight },
        });
        finish();
      }, 180);
      window.addEventListener("resize", onResize);
      // O evento pode ter chegado entre o commit nativo e a inscrição acima.
      queuePaintFrames();
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
      islandLog("morph:settle", { id: settled.id, mode: nextMode });
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
    islandLog("morph:prepare", {
      id: nextMorph.id,
      from: fromMode,
      to: toMode,
      geomViewport: geometry.viewport,
      fromRect: geometry.from,
      toRect: geometry.to,
    });

    /*
     * O estado inicial precisa estar pintado antes de ativar, senão o browser
     * junta os dois commits e não sobra transição para animar. A geometria já
     * vale nos dois tamanhos de janela (ver `resolveIslandPlacement`), então
     * não há reposicionamento depois do resize — era ele que deixava a pílula
     * alguns frames no canto da janela recém-expandida.
     */
    await waitForIslandPaint();
  }

  function startIslandMorph(): Promise<void> {
    const current = islandMorphRef.current;
    if (!current) {
      return Promise.resolve();
    }

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
    completion.timeoutId = window.setTimeout(
      () => completeIslandMorph(current.id),
      ISLAND_MORPH_DURATION_MS + ISLAND_MORPH_WATCHDOG_MS,
    );
    islandMorphCompletionRef.current = completion;

    const activeMorph = { ...current, active: true };
    islandMorphRef.current = activeMorph;
    setIslandMorph(activeMorph);
    islandLog("morph:start", { id: current.id });
    sampleViewportFrames(
      `morph-${current.id}-${current.fromMode}->${current.toMode}`,
      ISLAND_MORPH_DURATION_MS + ISLAND_MORPH_WATCHDOG_MS,
    );
    return promise;
  }

  function completeIslandMorph(id: number) {
    const completion = islandMorphCompletionRef.current;
    if (completion?.id !== id) {
      return;
    }
    if (completion.settled) {
      return;
    }
    completion.settled = true;
    window.clearTimeout(completion.timeoutId);
    completion.resolve();
  }

  async function waitForIslandMorph() {
    await islandMorphCompletionRef.current?.promise;
  }

  useWindowPosition({
    enabled:
      floatingReady &&
      (windowMode === "compact" || windowMode === "quick-menu") &&
      !transitioning,
    shouldPersist: () =>
      windowModeRef.current === "compact" ||
      windowModeRef.current === "quick-menu",
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
          await expandFromEdge();
        }
        if (cancelled || modeIntentRef.current !== "checklist") return;
        setChecklist(payload);
        await expandFloatingToChecklist({
          onPrepare: async (geometry) => {
            await prepareIslandMorph(geometry, "compact", "checklist");
          },
          onViewportReady: async (geometry) => {
            await waitForIslandViewportPaint(geometry);
          },
          onResizeStart: () => {
            void startIslandMorph();
          },
        });
        await waitForIslandMorph();
        if (!cancelled && modeIntentRef.current === "checklist") {
          await waitForIslandPaint();
          settleIslandMorph("checklist");
          await waitForIslandPaint();
        }
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
      modeIntentRef.current = "compact";
      rememberChecklistConversation(null);
      startTransition();
      void collapseChecklistToFloating({
        onBeforeCommit: async (geometry) => {
          await prepareIslandMorph(geometry, "checklist", "compact");
          await startIslandMorph();
        },
        onAfterCommit: async () => {
          if (!cancelled && modeIntentRef.current === "compact") {
            await waitForIslandPaint();
            settleIslandMorph("compact");
            await waitForIslandPaint();
          }
        },
      })
        .then(async () => {
          if (!cancelled && modeIntentRef.current === "compact") {
            setChecklist(null);
          }
        })
        .catch(() => {
          if (modeIntentRef.current === "compact") {
            modeIntentRef.current = "checklist";
          }
          clearIslandMorph();
        })
        .finally(() => {
          if (!cancelled) {
            finishTransition();
          }
        });
    }).then((dispose) => {
      unlistenDismiss = dispose;
    });

    return () => {
      cancelled = true;
      unlistenPayload?.();
      unlistenDismiss?.();
    };
  }, []);

  async function handleChecklistClose() {
    modeIntentRef.current = "compact";
    const conversationId = checklist?.conversationId ?? null;
    rememberChecklistConversation(null);
    if (conversationId) {
      await emitChecklistClosed({ conversationId });
    }
    startTransition();
    try {
      await collapseChecklistToFloating({
        onBeforeCommit: async (geometry) => {
          await prepareIslandMorph(geometry, "checklist", "compact");
          await startIslandMorph();
        },
        onAfterCommit: async () => {
          if (modeIntentRef.current === "compact") {
            await waitForIslandPaint();
            settleIslandMorph("compact");
            await waitForIslandPaint();
          }
        },
      });
      if (modeIntentRef.current === "compact") {
        restoreChatFocusRef.current = true;
        setChecklist(null);
      }
    } catch {
      if (modeIntentRef.current === "compact") {
        modeIntentRef.current = "checklist";
      }
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
      setPanelReady(false);
      await expandFloatingToQuickMenu({
        onPrepare: async (geometry) => {
          await prepareIslandMorph(geometry, "compact", "quick-menu");
        },
        onViewportReady: async (geometry) => {
          await waitForIslandViewportPaint(geometry);
        },
        onResizeStart: () => {
          void startIslandMorph();
        },
      });
      await waitForIslandMorph();
      if (modeIntentRef.current === "quick-menu") {
        await waitForIslandPaint();
        settleIslandMorph("quick-menu", { panelReady: true });
        await waitForIslandPaint();
      } else {
        setCaptureAndSendPending(false);
      }
    } catch {
      if (modeIntentRef.current === "quick-menu") {
        modeIntentRef.current = "compact";
        setPanelReady(false);
        setWindowMode("compact");
        setCaptureAndSendPending(false);
      }
      clearIslandMorph();
      void ensureCompactWindowBounds().catch(() => undefined);
    } finally {
      finishTransition();
    }
  }

  async function handleCaptureContext() {
    if (
      windowModeRef.current !== "compact" ||
      transitionCountRef.current > 0
    ) {
      return;
    }
    setCaptureAndSendPending(true);
    await handleOpenQuickMenu();
  }

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
    const closeTask = (async () => {
      try {
        setQuickMenuClosing(true);
        setPanelReady(false);
        await withDeadline(
          collapseQuickMenuToFloating({
            shouldCommit: () =>
              quickMenuCloseAttemptRef.current === closeAttempt,
            onBeforeCommit: async (geometry) => {
              await prepareIslandMorph(geometry, "quick-menu", "compact");
              await startIslandMorph();
            },
            onAfterCommit: async () => {
              if (
                quickMenuCloseAttemptRef.current === closeAttempt &&
                modeIntentRef.current === "compact"
              ) {
                await waitForIslandPaint();
                settleIslandMorph("compact");
                await waitForIslandPaint();
              }
            },
          }),
          QUICK_MENU_CLOSE_DEADLINE_MS,
        );
      } catch {
        if (quickMenuCloseAttemptRef.current === closeAttempt) {
          quickMenuCloseAttemptRef.current += 1;
        }
        void ensureCompactWindowBounds().catch(() => undefined);
      } finally {
        if (quickMenuCloseAttemptRef.current === closeAttempt) {
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
      const anchor = await collapseToEdge();
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
      await expandFromEdge();
      if (modeIntentRef.current === "compact") {
        restoreChatFocusRef.current = true;
        setWindowMode("compact");
      }
    } finally {
      finishTransition();
    }
  }

  async function handleHideQuickMenu() {
    await closeQuickMenu({ restoreFocus: false });
    /*
     * Esconder a janela ainda expandida a traz de volta expandida na próxima
     * vez, com a pílula desenhada dentro dela — daí a reconciliação aqui, mesmo
     * quando o fecho acima já pareceu bem-sucedido. É no-op se já está compacta.
     */
    modeIntentRef.current = "compact";
    await ensureCompactWindowBounds().catch(() => undefined);
    setPanelReady(false);
    setWindowMode("compact");
    await hideAllWindows();
  }

  async function handleResetPosition() {
    if (windowModeRef.current !== "compact") {
      return;
    }
    startTransition();
    try {
      await resetFloatingPosition();
      setEdgeAnchor(NO_ANCHOR);
    } finally {
      finishTransition();
    }
  }

  function handleQuickMenuDragStart() {
    suppressBlurCloseUntilRef.current = Date.now() + 1200;
  }

  /*
   * Captura de contexto tira o foco da janela por fora do webview — o seletor
   * do sistema e o overlay de recorte são janelas nativas. Sem esta trava o
   * `onFocusChanged` fecharia o quick menu no meio da captura, levando junto o
   * anexo pendente e o texto já digitado.
   */
  function handleCaptureActiveChange(active: boolean) {
    const wasActive = captureActiveRef.current;
    captureActiveRef.current = active;
    // A folga só vale na saída de uma captura de verdade: o foco só volta pra
    // cá alguns frames depois, e é esse blur residual que ela engole. Armá-la
    // no `false` inicial do painel silenciaria o fecho por blur comum.
    if (wasActive && !active) {
      suppressBlurCloseUntilRef.current = Date.now() + 800;
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
   * fica preso na tira. Com o foco já posto, `showMainBar` (que dá setFocus na
   * janela) deixa o handle pronto para `Enter`.
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
        void applyIslandWindowRegion({
          visual: visualSizeForMode(mode),
          scaleFactor: payload.scaleFactor,
          radius: visualRadiusForMode(mode),
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

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (
          !focused &&
          windowModeRef.current === "quick-menu" &&
          modeIntentRef.current === "quick-menu" &&
          !captureActiveRef.current &&
          Date.now() > suppressBlurCloseUntilRef.current
        ) {
          void closeQuickMenu({ restoreFocus: false });
        }
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

      await releaseMinWindowSize(win);
      if (cancelled) return;
      await win.setResizable(false);
      await win.setMaximizable(false);
    }

    void syncResizePolicy();

    return () => {
      cancelled = true;
    };
  }, [windowMode, transitioning, islandMorph]);

  /*
   * Rede de segurança do morph: os bounds nativos e o CSS são aplicados em
   * metades separadas, então todo caminho que aborta no meio (deadline de fecho
   * estourado, intenção trocada durante a expansão, erro de IPC) deixa a janela
   * grande com a pílula desenhada dentro dela. Em vez de tapar cada buraco
   * desses, o estado compacto é reconciliado sempre que assenta.
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

    void ensureCompactWindowBounds({
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
            void emitChecklistProgress({
              conversationId: checklist.conversationId,
              progress,
            });
          }}
          onClose={() => void handleChecklistClose()}
        />
      );
    }

    if (mode === "quick-menu") {
      return (
        <QuickCenterPanel
          apiHealthy={apiHealthy}
          sessionWarning={sessionWarning}
          user={user}
          ready={panelReady}
          visible
          closing={quickMenuClosing}
          autoCaptureAndSend={captureAndSendPending}
          onAutoCaptureAndSendConsumed={() => setCaptureAndSendPending(false)}
          onClose={(options) => void closeQuickMenu(options)}
          onOpenSettings={() => void closeQuickMenu({ restoreFocus: false })}
          onHide={() => void handleHideQuickMenu()}
          onWindowDragStart={handleQuickMenuDragStart}
          onCaptureActiveChange={handleCaptureActiveChange}
        />
      );
    }

    if (mode === "edge-collapsed") {
      return (
        <EdgeHandle
          anchor={edgeAnchor}
          isActive={isActive}
          onExpand={() => void handleExpandFromEdge()}
          buttonRef={edgeHandleRef}
        />
      );
    }

    return (
      <FloatingBar
        isActive={isActive}
        onOpenQuickMenu={() => void handleOpenQuickMenu()}
        onCaptureContext={() => void handleCaptureContext()}
        onCollapseToEdge={() => void handleCollapseToEdge()}
        onMinimize={() => void hideAllWindows()}
        onResetPosition={() => void handleResetPosition()}
        chatButtonRef={chatButtonRef}
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
    />
  );
}
