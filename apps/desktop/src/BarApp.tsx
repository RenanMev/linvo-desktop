import type { UserPublic } from "@linvo/shared";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import {
  collapseQuickMenuToFloating,
  expandFloatingToQuickMenu,
} from "@/lib/floating-quick-menu-mode";
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

export function BarApp({ sessionWarning, user }: BarAppProps) {
  const floatingReady = useFloatingBootstrap();
  const apiHealthy = useApiHealth(true);
  const [checklist, setChecklist] = useState<ChecklistWindowPayload | null>(
    null,
  );
  const [windowMode, setWindowMode] = useState<WindowMode>("compact");
  const [panelReady, setPanelReady] = useState(false);
  const [edgeAnchor, setEdgeAnchor] = useState<EdgeAnchor>(NO_ANCHOR);
  const [transitioning, setTransitioning] = useState(false);
  const windowModeRef = useRef(windowMode);
  const modeIntentRef = useRef<WindowMode>("compact");
  const transitionCountRef = useRef(0);
  const quickMenuCloseInFlightRef = useRef<Promise<void> | null>(null);
  const restoreChatFocusRef = useRef(false);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
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
      await expandFloatingToQuickMenu();
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
      try {
        await collapseQuickMenuToFloating();
      } catch {
        return;
      } finally {
        if (modeIntentRef.current === "compact") {
          setWindowMode("compact");
        }
        setPanelReady(false);
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
    await hideAllWindows();
    await closeQuickMenu({ restoreFocus: false });
  }

  useEffect(() => {
    if (windowMode !== "compact" || !restoreChatFocusRef.current) {
      return;
    }
    restoreChatFocusRef.current = false;
    chatButtonRef.current?.focus();
  }, [windowMode]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (
          !focused &&
          windowModeRef.current === "quick-menu" &&
          modeIntentRef.current === "quick-menu"
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

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden text-card-foreground",
        "transition-[border-radius] duration-200",
        checklistOpen || quickMenuOpen
          ? "window-shell rounded-premium"
          : "floating-pill rounded-full",
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
          onClose={(options) => void closeQuickMenu(options)}
          onOpenSettings={() =>
            void closeQuickMenu({ restoreFocus: false })
          }
          onHide={() => void handleHideQuickMenu()}
        />
      ) : edgeCollapsed ? (
        <EdgeHandle
          anchor={edgeAnchor}
          isActive={isActive}
          onExpand={() => void handleExpandFromEdge()}
        />
      ) : (
        <FloatingBar
          isActive={isActive}
          onOpenQuickMenu={() => void handleOpenQuickMenu()}
          onCollapseToEdge={() => void handleCollapseToEdge()}
          onMinimize={() => void hideAllWindows()}
          chatButtonRef={chatButtonRef}
        />
      )}
    </div>
  );
}
