import { ONBOARDING_STEP_ORDER, type OnboardingStepId } from "@/lib/onboarding/onboarding-steps";

const ONBOARDING_PROGRESS_PREFIX = "linvo.onboarding.progress:";

export type OnboardingProgressData = {
  stepId: OnboardingStepId;
  workspaceName: string;
  activeWorkspaceId: string | null;
  createdWorkspaceId: string | null;
  rules: Array<{ id: string; title: string; content: string }>;
  knowledgeIntent: "rule-review" | "procedures" | null;
  ruleDiscoverySessionId: string | null;
};

function keyForUser(userId: string): string {
  return `${ONBOARDING_PROGRESS_PREFIX}${userId}`;
}

function isValidProgress(value: unknown): value is OnboardingProgressData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return (
    typeof data.stepId === "string" &&
    ONBOARDING_STEP_ORDER.includes(data.stepId as OnboardingStepId) &&
    typeof data.workspaceName === "string" &&
    Array.isArray(data.rules)
  );
}

export function saveOnboardingProgress(
  userId: string,
  data: OnboardingProgressData,
): void {
  try {
    localStorage.setItem(keyForUser(userId), JSON.stringify(data));
  } catch {
    return;
  }
}

export function loadOnboardingProgress(
  userId: string,
): OnboardingProgressData | null {
  try {
    const raw = localStorage.getItem(keyForUser(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return isValidProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOnboardingProgress(userId: string): void {
  try {
    localStorage.removeItem(keyForUser(userId));
  } catch {
    return;
  }
}
