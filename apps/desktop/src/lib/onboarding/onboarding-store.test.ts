import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOnboardingCompleted,
  hasCompletedOnboarding,
  isOnboardingForced,
  markOnboardingCompleted,
} from "@/lib/onboarding/onboarding-store";

describe("onboarding-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores completion per user", () => {
    markOnboardingCompleted("user-1");

    expect(hasCompletedOnboarding("user-1")).toBe(true);
    expect(hasCompletedOnboarding("user-2")).toBe(false);
  });

  it("clears completion for a single user", () => {
    markOnboardingCompleted("user-1");
    markOnboardingCompleted("user-2");

    clearOnboardingCompleted("user-1");

    expect(hasCompletedOnboarding("user-1")).toBe(false);
    expect(hasCompletedOnboarding("user-2")).toBe(true);
  });

  it("is forced only when the env flag is exactly \"1\"", () => {
    expect(isOnboardingForced()).toBe(false);

    vi.stubEnv("VITE_ONBOARDING_FORCE", "1");
    expect(isOnboardingForced()).toBe(true);

    vi.stubEnv("VITE_ONBOARDING_FORCE", "true");
    expect(isOnboardingForced()).toBe(false);
  });
});
