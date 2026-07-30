import { beforeEach, describe, expect, it } from "vitest";

import {
  clearOnboardingProgress,
  loadOnboardingProgress,
  saveOnboardingProgress,
  type OnboardingProgressData,
} from "@/lib/onboarding/onboarding-progress-store";

const sample: OnboardingProgressData = {
  stepId: "context",
  workspaceName: "Acme",
  activeWorkspaceId: null,
  createdWorkspaceId: "ws-1",
  rules: [{ id: "r1", title: "Tom", content: "Formal" }],
  knowledgeIntent: null,
  ruleDiscoverySessionId: null,
};

describe("onboarding-progress-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads progress per user", () => {
    saveOnboardingProgress("user-1", sample);

    expect(loadOnboardingProgress("user-1")).toEqual(sample);
    expect(loadOnboardingProgress("user-2")).toBeNull();
  });

  it("clears progress for a single user", () => {
    saveOnboardingProgress("user-1", sample);
    saveOnboardingProgress("user-2", { ...sample, workspaceName: "Beta" });

    clearOnboardingProgress("user-1");

    expect(loadOnboardingProgress("user-1")).toBeNull();
    expect(loadOnboardingProgress("user-2")).not.toBeNull();
  });

  it("returns null for corrupted payloads", () => {
    localStorage.setItem("linvo.onboarding.progress:user-1", "not json");
    expect(loadOnboardingProgress("user-1")).toBeNull();
  });

  it("returns null when stepId is not a known step", () => {
    localStorage.setItem(
      "linvo.onboarding.progress:user-1",
      JSON.stringify({ ...sample, stepId: "not_a_step" }),
    );
    expect(loadOnboardingProgress("user-1")).toBeNull();
  });
});
