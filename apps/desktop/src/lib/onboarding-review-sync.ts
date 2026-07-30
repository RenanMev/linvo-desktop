import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const ONBOARDING_REVIEW_EVENT = "onboarding://review";

export type OnboardingReviewPayload = {
  source: string;
};

export async function requestOnboardingReview(): Promise<void> {
  const source = (await getCurrentWindow()).label;
  await emit(ONBOARDING_REVIEW_EVENT, { source } satisfies OnboardingReviewPayload);
}

export async function listenOnboardingReview(
  handler: () => void,
): Promise<() => void> {
  const self = (await getCurrentWindow()).label;
  const unlisten = await listen<OnboardingReviewPayload>(
    ONBOARDING_REVIEW_EVENT,
    (event) => {
      if (event.payload.source === self) {
        return;
      }
      handler();
    },
  );
  return unlisten;
}
