import { describe, expect, it } from "vitest";

import { resolveOnboardingRoute } from "@/lib/onboarding/onboarding-routing";

describe("resolveOnboardingRoute", () => {
  it("routes to rule-review when there are candidates", () => {
    expect(
      resolveOnboardingRoute({
        workspaceId: "ws-1",
        knowledgeIntent: "rule-review",
        candidateCount: 3,
      }),
    ).toBe("/settings/workspace/ws-1/rule-review");
  });

  it("stays on the island (null) when rule-review intent has no candidates", () => {
    expect(
      resolveOnboardingRoute({
        workspaceId: "ws-1",
        knowledgeIntent: "rule-review",
        candidateCount: 0,
      }),
    ).toBeNull();
  });

  it("routes to procedures regardless of candidate count", () => {
    expect(
      resolveOnboardingRoute({
        workspaceId: "ws-1",
        knowledgeIntent: "procedures",
        candidateCount: 0,
      }),
    ).toBe("/settings/workspace/ws-1/procedures");
  });

  it("stays on the island (null) when there is no intent or no workspace", () => {
    expect(
      resolveOnboardingRoute({
        workspaceId: "ws-1",
        knowledgeIntent: null,
        candidateCount: 0,
      }),
    ).toBeNull();

    expect(
      resolveOnboardingRoute({
        workspaceId: null,
        knowledgeIntent: "rule-review",
        candidateCount: 5,
      }),
    ).toBeNull();
  });
});
