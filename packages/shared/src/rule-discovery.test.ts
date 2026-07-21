import { describe, expect, it } from "vitest";

import {
  ruleDiscoveryEventSchema,
  ruleDiscoverySessionDetailSchema,
  updateRuleDiscoverySessionInputSchema,
  undoRuleCandidateResponseSchema,
} from "./rule-discovery";

const baseCandidate = {
  id: "cand-1",
  sessionId: "session-1",
  sourceDocumentId: "doc-1",
  category: "BUSINESS_RULE" as const,
  title: "Regra",
  content: "Conteúdo",
  confidence: 0.9,
  sourceExcerpt: null,
  status: "PENDING" as const,
  promoteToRule: true,
  promoteToKnowledge: false,
  promotionSource: null,
  businessRuleId: null,
  knowledgeDocumentId: null,
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

describe("ruleDiscoveryEventSchema", () => {
  it("accepts a valid event", () => {
    const result = ruleDiscoveryEventSchema.safeParse({
      id: "evt-1",
      sessionId: "session-1",
      seq: 1,
      type: "session_started",
      message: "Análise iniciada",
      payload: { foo: "bar" },
      createdAt: "2026-07-20T20:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown event type", () => {
    const result = ruleDiscoveryEventSchema.safeParse({
      id: "evt-1",
      sessionId: "session-1",
      seq: 1,
      type: "unknown",
      message: "x",
      payload: null,
      createdAt: "2026-07-20T20:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateRuleDiscoverySessionInputSchema", () => {
  it("accepts approvalMode", () => {
    expect(
      updateRuleDiscoverySessionInputSchema.safeParse({
        approvalMode: "ALLOW",
      }).success,
    ).toBe(true);
  });

  it("rejects confidenceThreshold outside [0,1]", () => {
    expect(
      updateRuleDiscoverySessionInputSchema.safeParse({
        confidenceThreshold: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects empty patch", () => {
    expect(updateRuleDiscoverySessionInputSchema.safeParse({}).success).toBe(
      false,
    );
  });
});

describe("ruleDiscoverySessionDetailSchema", () => {
  it("requires approvalMode, confidenceThreshold and events", () => {
    const result = ruleDiscoverySessionDetailSchema.safeParse({
      id: "session-1",
      workspaceId: "ws-1",
      status: "READY",
      approvalMode: "QUESTION",
      confidenceThreshold: 0.75,
      error: null,
      documents: [],
      candidates: [baseCandidate],
      events: [
        {
          id: "evt-1",
          sessionId: "session-1",
          seq: 1,
          type: "session_ready",
          message: "Pronto",
          payload: null,
          createdAt: "2026-07-20T20:00:00.000Z",
        },
      ],
      createdAt: "2026-07-20T20:00:00.000Z",
      updatedAt: "2026-07-20T20:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("undoRuleCandidateResponseSchema", () => {
  it("accepts candidate payload", () => {
    const result = undoRuleCandidateResponseSchema.safeParse({
      candidate: {
        ...baseCandidate,
        status: "REJECTED",
        promotionSource: "AUTO",
      },
    });
    expect(result.success).toBe(true);
  });
});
