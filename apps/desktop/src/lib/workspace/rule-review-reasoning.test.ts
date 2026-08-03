import { describe, expect, it } from "vitest";

import {
  buildDocumentStages,
  getLiveStep,
  getLiveStepDetail,
  getSessionSummaryEvent,
} from "@/lib/workspace/rule-review-reasoning";

describe("rule-review-reasoning", () => {
  const documents = [
    {
      id: "doc-1",
      originalName: "manual.txt",
      mimeType: "text/plain",
      status: "EXTRACTED" as const,
      error: null,
      createdAt: "2026-07-20T20:00:00.000Z",
      updatedAt: "2026-07-20T20:00:00.000Z",
    },
  ];

  const events = [
    {
      id: "evt-1",
      sessionId: "session-1",
      seq: 1,
      type: "session_started" as const,
      message: "Análise iniciada",
      payload: null,
      createdAt: "2026-07-20T20:00:00.000Z",
    },
    {
      id: "evt-2",
      sessionId: "session-1",
      seq: 2,
      type: "candidate_found" as const,
      message: "Encontrei: Regra sugerida",
      payload: {
        candidateId: "candidate-1",
        documentId: "doc-1",
        rationale: "obrigação clara",
      },
      createdAt: "2026-07-20T20:00:01.000Z",
    },
    {
      id: "evt-3",
      sessionId: "session-1",
      seq: 3,
      type: "document_done" as const,
      message: "Concluído: manual.txt (1 candidato(s))",
      payload: { documentId: "doc-1", candidateCount: 1 },
      createdAt: "2026-07-20T20:00:02.000Z",
    },
    {
      id: "evt-4",
      sessionId: "session-1",
      seq: 4,
      type: "session_ready" as const,
      message: "Análise concluída",
      payload: null,
      createdAt: "2026-07-20T20:00:03.000Z",
    },
  ];

  it("returns last non-terminal event while processing", () => {
    expect(getLiveStep(events.slice(0, 2), true)?.id).toBe("evt-2");
  });

  it("returns last event when finished", () => {
    expect(getLiveStep(events, false)?.id).toBe("evt-4");
  });

  it("extracts rationale from merged candidate_found payload", () => {
    expect(getLiveStepDetail(events[1])).toBe("obrigação clara");
  });

  it("builds document stages with done status", () => {
    expect(buildDocumentStages(events, documents, "READY")).toEqual([
      {
        documentId: "doc-1",
        label: "manual.txt",
        status: "done",
        candidateCount: 1,
      },
    ]);
  });

  it("finds session summary event", () => {
    expect(getSessionSummaryEvent(events)?.type).toBe("session_ready");
  });
});
