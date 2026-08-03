import type { RuleDiscoveryEvent, RuleSourceDocument } from "@linvo/shared";

export const REASONING_COLLAPSED_KEY = "linvo.rule-review.reasoning-collapsed";

export type DocumentStageStatus = "pending" | "active" | "done" | "failed";

export type DocumentStage = {
  documentId: string;
  label: string;
  status: DocumentStageStatus;
  candidateCount: number;
};

const TERMINAL_SESSION_EVENTS = new Set<string>([
  "session_ready",
  "session_failed",
  "session_cancelled",
]);

function payloadDocumentId(
  payload: RuleDiscoveryEvent["payload"],
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const docId = (payload as { documentId?: unknown }).documentId;
  return typeof docId === "string" ? docId : null;
}

function payloadRationale(payload: RuleDiscoveryEvent["payload"]): string | null {
  if (!payload || typeof payload !== "object") return null;
  const rationale = (payload as { rationale?: unknown }).rationale;
  return typeof rationale === "string" && rationale.trim() ? rationale : null;
}

export function readReasoningCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(REASONING_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeReasoningCollapsedPreference(collapsed: boolean): void {
  try {
    localStorage.setItem(REASONING_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    undefined;
  }
}

export function getLiveStep(
  events: RuleDiscoveryEvent[],
  isProcessing: boolean,
): RuleDiscoveryEvent | null {
  if (events.length === 0) return null;

  if (isProcessing) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (!TERMINAL_SESSION_EVENTS.has(event.type)) {
        return event;
      }
    }
  }

  return events[events.length - 1] ?? null;
}

export function getLiveStepDetail(event: RuleDiscoveryEvent | null): string | null {
  if (!event) return null;
  if (event.type === "candidate_found" || event.type === "classified") {
    return payloadRationale(event.payload);
  }
  return null;
}

export function countDocumentsDone(events: RuleDiscoveryEvent[]): number {
  return events.filter((event) => event.type === "document_done").length;
}

export function countAutoPromoted(events: RuleDiscoveryEvent[]): number {
  return events.filter((event) => event.type === "auto_promoted").length;
}

export function getSessionSummaryEvent(
  events: RuleDiscoveryEvent[],
): RuleDiscoveryEvent | null {
  return (
    events.find(
      (event) =>
        event.type === "session_ready" ||
        event.type === "session_failed" ||
        event.type === "session_cancelled",
    ) ?? null
  );
}

export function getActiveDocumentId(
  events: RuleDiscoveryEvent[],
  documents: RuleSourceDocument[],
): string | null {
  const doneIds = new Set(
    events
      .filter((event) => event.type === "document_done")
      .map((event) => payloadDocumentId(event.payload))
      .filter((id): id is string => Boolean(id)),
  );

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const docId = payloadDocumentId(events[index].payload);
    if (docId && !doneIds.has(docId)) {
      return docId;
    }
  }

  const pending = documents.find(
    (doc) => doc.status === "PENDING" || doc.status === "EXTRACTING",
  );
  return pending?.id ?? null;
}

export function buildDocumentStages(
  events: RuleDiscoveryEvent[],
  documents: RuleSourceDocument[],
  sessionStatus?: "PENDING" | "PROCESSING" | "READY" | "FAILED" | "CANCELLED",
): DocumentStage[] {
  const candidateCounts = new Map<string, number>();

  for (const event of events) {
    if (event.type !== "document_done") continue;
    const docId = payloadDocumentId(event.payload);
    if (!docId) continue;
    const count = (event.payload as { candidateCount?: unknown })?.candidateCount;
    candidateCounts.set(docId, typeof count === "number" ? count : 0);
  }

  const activeId = getActiveDocumentId(events, documents);
  const doneIds = new Set(
    events
      .filter((event) => event.type === "document_done")
      .map((event) => payloadDocumentId(event.payload))
      .filter((id): id is string => Boolean(id)),
  );
  const isFinished =
    sessionStatus === "READY" ||
    sessionStatus === "FAILED" ||
    sessionStatus === "CANCELLED";

  return documents.map((document) => {
    let status: DocumentStageStatus = "pending";
    if (document.status === "FAILED") {
      status = "failed";
    } else if (doneIds.has(document.id)) {
      status = "done";
    } else if (document.id === activeId && !isFinished) {
      status = "active";
    } else if (isFinished && document.status === "EXTRACTED") {
      status = "done";
    }

    return {
      documentId: document.id,
      label: document.originalName,
      status,
      candidateCount: candidateCounts.get(document.id) ?? 0,
    };
  });
}

export function getDocumentChipStatus(
  document: RuleSourceDocument,
  activeDocumentId: string | null,
  doneDocumentIds: Set<string>,
): DocumentStageStatus {
  if (document.status === "FAILED") return "failed";
  if (doneDocumentIds.has(document.id)) return "done";
  if (document.id === activeDocumentId) return "active";
  if (document.status === "PENDING" || document.status === "EXTRACTING") {
    return "pending";
  }
  return "done";
}
