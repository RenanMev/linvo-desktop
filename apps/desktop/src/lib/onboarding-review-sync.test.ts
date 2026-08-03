import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitMock, listenMock } from "@/test/mocks/tauri";
import {
  ONBOARDING_REVIEW_EVENT,
  listenOnboardingReview,
  requestOnboardingReview,
} from "@/lib/onboarding-review-sync";

describe("onboarding-review-sync", () => {
  beforeEach(() => {
    emitMock.mockClear();
    listenMock.mockClear();
  });

  it("emits the review event with the current window as source", async () => {
    await requestOnboardingReview();

    expect(emitMock).toHaveBeenCalledWith(ONBOARDING_REVIEW_EVENT, {
      source: "main",
    });
  });

  it("ignores events emitted by itself and calls the handler otherwise", async () => {
    const handler = vi.fn();
    await listenOnboardingReview(handler);

    const registeredHandler = listenMock.mock.calls[0]?.[1] as (event: {
      payload: { source: string };
    }) => void;

    registeredHandler({ payload: { source: "main" } });
    expect(handler).not.toHaveBeenCalled();

    registeredHandler({ payload: { source: "panel" } });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
