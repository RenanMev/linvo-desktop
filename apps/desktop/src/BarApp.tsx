import type { UserPublic } from "@linvo/shared";
import { useEffect, useState } from "react";

import { FloatingBar } from "@/components/floating-bar";
import { ProcedureChecklistPanel } from "@/components/procedure/procedure-checklist-panel";
import { useApiHealth } from "@/hooks/use-api-health";
import { useFloatingBootstrap } from "@/hooks/use-floating-bootstrap";
import { useWindowPosition } from "@/hooks/use-window-position";
import {
  collapseChecklistToFloating,
  expandFloatingToChecklist,
} from "@/lib/floating-checklist-mode";
import { openPanel } from "@/lib/panel-window";
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

export function BarApp({ sessionWarning, user }: BarAppProps) {
  const floatingReady = useFloatingBootstrap();
  const apiHealthy = useApiHealth(true);
  const [checklist, setChecklist] = useState<ChecklistWindowPayload | null>(
    null,
  );
  const [transitioning, setTransitioning] = useState(false);

  const isActive = floatingReady && apiHealthy && !sessionWarning;
  const checklistOpen = checklist !== null;

  useWindowPosition({
    enabled: floatingReady && !checklistOpen && !transitioning,
    shouldPersist: () => !checklistOpen,
  });

  useEffect(() => {
    let unlistenPayload: (() => void) | undefined;
    let unlistenDismiss: (() => void) | undefined;
    let cancelled = false;

    void listenChecklistPayload((payload) => {
      if (cancelled) return;
      setChecklist(payload);
      setTransitioning(true);
      void expandFloatingToChecklist().finally(() => {
        if (!cancelled) {
          setTransitioning(false);
        }
      });
    }).then((dispose) => {
      unlistenPayload = dispose;
    });

    void listenChecklistDismiss(() => {
      if (cancelled) return;
      setChecklist(null);
      rememberChecklistConversation(null);
      setTransitioning(true);
      void collapseChecklistToFloating().finally(() => {
        if (!cancelled) {
          setTransitioning(false);
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
    const conversationId = checklist?.conversationId ?? null;
    setChecklist(null);
    rememberChecklistConversation(null);
    if (conversationId) {
      await emitChecklistClosed({ conversationId });
    }
    setTransitioning(true);
    try {
      await collapseChecklistToFloating();
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden text-card-foreground",
        "transition-[border-radius] duration-200",
        checklistOpen
          ? "window-shell rounded-premium"
          : "floating-pill rounded-full",
      )}
    >
      {checklistOpen ? (
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
      ) : (
        <FloatingBar
          isActive={isActive}
          onChat={() => void openPanel("/chat", user)}
          onOpenSettings={() => void openPanel("/settings/general", user)}
        />
      )}
    </div>
  );
}
