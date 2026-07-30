export type OnboardingStepId =
  | "welcome"
  | "workspace"
  | "context"
  | "knowledge"
  | "appearance"
  | "bar_tour"
  | "first_question";

export type StepStatus = "pending" | "current" | "completed" | "skipped";

export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  "welcome",
  "workspace",
  "context",
  "knowledge",
  "appearance",
  "bar_tour",
  "first_question",
];

export function resolveStepStates(input: {
  currentStepId: OnboardingStepId;
  completedIds: Set<OnboardingStepId>;
  skippedIds: Set<OnboardingStepId>;
}): Array<{ id: OnboardingStepId; status: StepStatus }> {
  const { currentStepId, completedIds, skippedIds } = input;

  return ONBOARDING_STEP_ORDER.map((id) => {
    if (id === currentStepId) {
      return { id, status: "current" as const };
    }
    if (skippedIds.has(id)) {
      return { id, status: "skipped" as const };
    }
    if (completedIds.has(id)) {
      return { id, status: "completed" as const };
    }
    return { id, status: "pending" as const };
  });
}

export function isStepNavigable(status: StepStatus): boolean {
  return status === "completed" || status === "skipped";
}

export function nextStepId(current: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEP_ORDER.indexOf(current);
  return ONBOARDING_STEP_ORDER[index + 1] ?? null;
}

export function previousStepId(
  current: OnboardingStepId,
): OnboardingStepId | null {
  const index = ONBOARDING_STEP_ORDER.indexOf(current);
  if (index <= 0) {
    return null;
  }
  return ONBOARDING_STEP_ORDER[index - 1] ?? null;
}
