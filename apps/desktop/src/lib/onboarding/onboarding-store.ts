const ONBOARDING_COMPLETED_PREFIX = "linvo.onboarding.completed:";

function keyForUser(userId: string): string {
  return `${ONBOARDING_COMPLETED_PREFIX}${userId}`;
}

export function hasCompletedOnboarding(userId: string): boolean {
  try {
    return localStorage.getItem(keyForUser(userId)) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(userId: string): void {
  try {
    localStorage.setItem(keyForUser(userId), "1");
  } catch {
    return;
  }
}

export function clearOnboardingCompleted(userId: string): void {
  try {
    localStorage.removeItem(keyForUser(userId));
  } catch {
    return;
  }
}

export function isOnboardingForced(): boolean {
  return import.meta.env.VITE_ONBOARDING_FORCE === "1";
}
