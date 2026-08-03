import { useEffect, useRef } from "react";
import type { Procedure, ProcedureStatus } from "@linvo/shared";

import { notifyDesktopEvent } from "@/lib/desktop-notifications";
import * as procedureApi from "@/lib/procedure/procedure-api";

const DEFAULT_POLL_MS = 3_000;
const POLL_STATUSES: ProcedureStatus[] = [
  "PROCESSING",
  "PENDING_REVIEW",
  "FAILED",
  "PUBLISHED",
];

export function useProcedureStatusPoll(
  workspaceId: string | undefined,
  options: {
    enabled?: boolean;
    intervalMs?: number;
    onUpdate?: (procedures: Procedure[]) => void;
    notify?: (body: string) => Promise<void>;
  } = {},
): void {
  const enabled = options.enabled !== false;
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_MS;
  const notify = options.notify ?? notifyDesktopEvent;
  const onUpdate = options.onUpdate;
  const seenRef = useRef<Map<string, ProcedureStatus>>(new Map());

  useEffect(() => {
    if (!workspaceId || !enabled) {
      return;
    }

    let cancelled = false;

    async function tick() {
      try {
        const procedures = await procedureApi.listProcedures(
          workspaceId!,
          POLL_STATUSES,
        );
        if (cancelled) {
          return;
        }

        for (const procedure of procedures) {
          const previous = seenRef.current.get(procedure.id);
          if (
            procedure.status === "PENDING_REVIEW" &&
            (previous === undefined || previous === "PROCESSING")
          ) {
            void notify("Markdown do procedure pronto para revisão.");
          }
          if (
            procedure.status === "FAILED" &&
            (previous === undefined || previous === "PROCESSING")
          ) {
            void notify("Falha no processamento do procedure.");
          }
          seenRef.current.set(procedure.id, procedure.status);
        }

        onUpdate?.(procedures);
      } catch {
        return;
      }
    }

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, notify, onUpdate, workspaceId]);
}
