import { useEffect, useState } from "react";

import { ProcedureChecklistPanel } from "@/components/procedure/procedure-checklist-panel";
import { useWindowPosition } from "@/hooks/use-window-position";
import {
  closeChecklist,
  emitChecklistProgress,
  listenChecklistPayload,
  rememberChecklistConversation,
  type ChecklistWindowPayload,
} from "@/lib/checklist-window";
import { CHECKLIST_POSITION_STORAGE_KEY } from "@/lib/window-storage";

export function ChecklistApp() {
  const [payload, setPayload] = useState<ChecklistWindowPayload | null>(null);

  useWindowPosition({
    enabled: true,
    shouldPersist: () => true,
    storageKey: CHECKLIST_POSITION_STORAGE_KEY,
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenChecklistPayload((next) => {
      setPayload(next);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  async function handleClose() {
    const conversationId = payload?.conversationId ?? null;
    setPayload(null);
    rememberChecklistConversation(conversationId);
    await closeChecklist({ emitClosed: true });
  }

  return (
    <div className="window-shell relative h-full w-full overflow-hidden rounded-premium text-card-foreground">
      {payload ? (
        <ProcedureChecklistPanel
          key={`${payload.conversationId}-${payload.procedure.id}`}
          title={
            payload.procedure.title?.trim() ||
            payload.procedure.slug ||
            "Procedure"
          }
          slug={payload.procedure.slug ?? ""}
          steps={payload.procedure.steps ?? []}
          initialCompleted={payload.progress.completedStepIndexes}
          onProgressChange={(progress) => {
            void emitChecklistProgress({
              conversationId: payload.conversationId,
              progress,
            });
          }}
          onClose={() => {
            void handleClose();
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center font-technical text-[11px] tracking-wide text-muted-foreground">
          Aguardando checklist...
        </div>
      )}
    </div>
  );
}
