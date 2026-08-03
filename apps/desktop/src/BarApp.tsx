import type { UserPublic } from "@linvo/shared";
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";

import { EdgeHandle } from "@/components/edge-handle";
import { FloatingBar } from "@/components/floating-bar";
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
import { collapseToEdge, expandFromEdge } from "@/lib/floating-edge-mode";
import { resetFloatingPosition } from "@/lib/floating-position-reset";
import {
  collapseQuickMenuToFloating,
  expandFloatingToQuickMenu,
} from "@/lib/floating-quick-menu-mode";
import { COMPACT_SIZE } from "@/lib/window-mode";
import { NO_ANCHOR, type EdgeAnchor } from "@/lib/window-anchor";
import { cn } from "@/lib/utils";
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

type WindowMode = "compact" | "quick-menu" | "checklist" | "edge-collapsed";
type CloseQuickMenuOptions = {
  restoreFocus?: boolean;
  preserveIntent?: boolean;
};
const QUICK_MENU_MIN_SIZE = { width: 320, height: 360 };
const QUICK_MENU_EXIT_DURATION_MS = 140;

export function BarApp({ sessionWarning, user }: BarAppProps) {
  const floatingReady = useFloatingBootstrap();
  const apiHealthy = useApiHealth(true);
  const [checklist, setChecklist] = useState<ChecklistWindowPayload | null>(
    null,
  );
  const [windowMode, setWindowMode] = useState<WindowMode>("compact");
  const [panelReady, setPanelReady] = useState(false);
  const [quickMenuClosing, setQuickMenuClosing] = useState(false);
  const [edgeAnchor, setEdgeAnchor] = useState<EdgeAnchor>(NO_ANCHOR);
  const [transitioning, setTransitioning] = useState(false);
  const windowModeRef = useRef(windowMode);
  const modeIntentRef = useRef<WindowMode>("compact");
  const transitionCountRef = useRef(0);
  const quickMenuCloseInFlightRef = useRef<Promise<void> | null>(null);
  const restoreChatFocusRef = useRef(false);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  const edgeHandleRef = useRef<HTMLButtonElement>(null);
  const suppressBlurCloseUntilRef = useRef(0);
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
        setWindowMode("checklist");
        await expandFloatingToChecklist();
        if (!cancelled && modeIntentRef.current === "checklist") {
          setWindowMode("checklist");
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
      setChecklist(null);
      rememberChecklistConversation(null);
      startTransition();
      void collapseChecklistToFloating()
        .then(() => {
          if (!cancelled && modeIntentRef.current === "compact") {
            setWindowMode("compact");
          }
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
    setChecklist(null);
    rememberChecklistConversation(null);
    if (conversationId) {
      await emitChecklistClosed({ conversationId });
    }
    startTransition();
    try {
      await collapseChecklistToFloating();
      if (modeIntentRef.current === "compact") {
        restoreChatFocusRef.current = true;
        setWindowMode("compact");
      }
    } finally {
      finishTransition();
    }
  }

  async function handleOpenQuickMenu() {
    if (windowModeRef.current !== "compact") {
      return;
    }
    modeIntentRef.current = "quick-menu";
    startTransition();
    setWindowMode("quick-menu");
    try {
      await expandFloatingToQuickMenu({
        // Conteúdo entra junto com o crescimento da janela, não depois dele.
        onResizeStart: () => {
          if (modeIntentRef.current === "quick-menu") {
            setPanelReady(true);
          }
        },
      });
      if (modeIntentRef.current === "quick-menu") {
        setPanelReady(true);
      }
    } catch {
      if (modeIntentRef.current === "quick-menu") {
        modeIntentRef.current = "compact";
        setPanelReady(false);
        setWindowMode("compact");
      }
    } finally {
      finishTransition();
    }
  }

  async function closeQuickMenu(
    options: CloseQuickMenuOptions = {},
  ): Promise<void> {
    if (
      !options.preserveIntent &&
      modeIntentRef.current === "quick-menu"
    ) {
      modeIntentRef.current = "compact";
    }

    if (
      windowModeRef.current !== "quick-menu" &&
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
    const closeTask = (async () => {
      let collapsed = false;
      try {
        setQuickMenuClosing(true);
        setPanelReady(false);
        await new Promise((resolve) =>
          window.setTimeout(resolve, QUICK_MENU_EXIT_DURATION_MS),
        );
        await collapseQuickMenuToFloating();
        collapsed = true;
      } catch {
        if (modeIntentRef.current === "compact") {
          modeIntentRef.current = "quick-menu";
        }
        return;
      } finally {
        if (collapsed && modeIntentRef.current === "compact") {
          setWindowMode("compact");
        }
        setPanelReady(false);
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

  async function forceCompactWindowSize() {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    await win.setMinSize(null);
    await win.setResizable(false);
    await win.setSize(
      new PhysicalSize(
        Math.ceil(COMPACT_SIZE.width * scale),
        Math.ceil(COMPACT_SIZE.height * scale),
      ),
    );
  }

  async function handleHideQuickMenu() {
    await closeQuickMenu({ restoreFocus: false });
    if (modeIntentRef.current !== "compact") {
      modeIntentRef.current = "compact";
      await forceCompactWindowSize();
      setPanelReady(false);
      setWindowMode("compact");
    }
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

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (
          !focused &&
          windowModeRef.current === "quick-menu" &&
          modeIntentRef.current === "quick-menu" &&
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

  const checklistOpen = windowMode === "checklist" && checklist !== null;
  const quickMenuOpen = windowMode === "quick-menu";
  const edgeCollapsed = windowMode === "edge-collapsed";

  useEffect(() => {
    let cancelled = false;
    const win = getCurrentWindow();

    async function syncResizePolicy() {
      if (windowMode === "quick-menu") {
        const scale = await win.scaleFactor();
        if (cancelled) return;
        await win.setResizable(true);
        await win.setMaximizable(false);
        if (cancelled) return;
        await win.setMinSize(
          new PhysicalSize(
            Math.ceil(QUICK_MENU_MIN_SIZE.width * scale),
            Math.ceil(QUICK_MENU_MIN_SIZE.height * scale),
          ),
        );
        return;
      }

      await win.setMinSize(null);
      if (cancelled) return;
      await win.setResizable(false);
      await win.setMaximizable(false);
    }

    void syncResizePolicy();

    return () => {
      cancelled = true;
    };
  }, [windowMode]);

  return (
    /*
     * Gutter transparente de 1px em volta da superfície. A janela Tauri tem
     * exatamente o tamanho do conteúdo, então uma borda de 1px encostada na
     * borda do viewport cai na última linha de pixels físicos e desaparece no
     * antialiasing em DPI fracionário (125%/150%) — era por isso que a pílula
     * ficava sem border-bottom. Com o gutter, o arredondamento sobra na área
     * transparente e a borda sempre pinta inteira.
     */
    <div className="h-full w-full p-px">
      <div
        className={cn(
          /*
           * Sem transição de border-radius/cor aqui: a janela pula direto pro
           * tamanho final, então a troca pílula→painel acontece atrás do
           * scale-in do painel e não precisa ser animada. Transicionar o pai
           * enquanto o filho escala custaria paint da superfície inteira por
           * frame — era parte do que trepidava.
           */
          "relative h-full w-full overflow-hidden text-card-foreground",
          checklistOpen || quickMenuOpen
            ? "window-shell rounded-premium"
            : "floating-pill rounded-pill",
        )}
      >
        {checklistOpen && checklist ? (
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
            onClose={() => {
              void handleChecklistClose();
            }}
          />
        ) : quickMenuOpen ? (
          <QuickCenterPanel
            apiHealthy={apiHealthy}
            sessionWarning={sessionWarning}
            user={user}
            ready={panelReady}
            closing={quickMenuClosing}
            onClose={(options) => void closeQuickMenu(options)}
            onOpenSettings={() =>
              void closeQuickMenu({ restoreFocus: false })
            }
            onHide={() => void handleHideQuickMenu()}
            onWindowDragStart={handleQuickMenuDragStart}
          />
        ) : edgeCollapsed ? (
          <EdgeHandle
            anchor={edgeAnchor}
            isActive={isActive}
            onExpand={() => void handleExpandFromEdge()}
            buttonRef={edgeHandleRef}
          />
        ) : (
          <FloatingBar
            isActive={isActive}
            onOpenQuickMenu={() => void handleOpenQuickMenu()}
            onCollapseToEdge={() => void handleCollapseToEdge()}
            onMinimize={() => void hideAllWindows()}
            onResetPosition={() => void handleResetPosition()}
            chatButtonRef={chatButtonRef}
          />
        )}
      </div>
    </div>
  );
}
