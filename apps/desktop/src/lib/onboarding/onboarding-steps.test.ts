import { describe, expect, it } from "vitest";

import {
  ONBOARDING_STEP_ORDER,
  isStepNavigable,
  nextStepId,
  previousStepId,
  resolveStepStates,
} from "@/lib/onboarding/onboarding-steps";

describe("onboarding-steps", () => {
  it("orders the 7 steps as specified", () => {
    expect(ONBOARDING_STEP_ORDER).toEqual([
      "welcome",
      "workspace",
      "context",
      "knowledge",
      "appearance",
      "bar_tour",
      "first_question",
    ]);
  });

  it("resolves states: exactly one current, mix of completed/skipped/pending", () => {
    const states = resolveStepStates({
      currentStepId: "knowledge",
      completedIds: new Set(["welcome", "workspace"]),
      skippedIds: new Set(["context"]),
    });

    expect(states).toEqual([
      { id: "welcome", status: "completed" },
      { id: "workspace", status: "completed" },
      { id: "context", status: "skipped" },
      { id: "knowledge", status: "current" },
      { id: "appearance", status: "pending" },
      { id: "bar_tour", status: "pending" },
      { id: "first_question", status: "pending" },
    ]);
  });

  it("treats only completed/skipped as navigable", () => {
    expect(isStepNavigable("completed")).toBe(true);
    expect(isStepNavigable("skipped")).toBe(true);
    expect(isStepNavigable("current")).toBe(false);
    expect(isStepNavigable("pending")).toBe(false);
  });

  it("returns null at the ends for next/previous", () => {
    expect(nextStepId("first_question")).toBeNull();
    expect(previousStepId("welcome")).toBeNull();
    expect(nextStepId("welcome")).toBe("workspace");
    expect(previousStepId("workspace")).toBe("welcome");
  });
});
