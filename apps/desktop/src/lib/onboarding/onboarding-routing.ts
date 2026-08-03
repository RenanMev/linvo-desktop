export type OnboardingKnowledgeIntent = "rule-review" | "procedures" | null;

export function resolveOnboardingRoute(input: {
  workspaceId: string | null;
  knowledgeIntent: OnboardingKnowledgeIntent;
  candidateCount: number;
}): string {
  const { workspaceId, knowledgeIntent, candidateCount } = input;

  if (!workspaceId) {
    return "/chat";
  }

  if (knowledgeIntent === "rule-review") {
    return candidateCount > 0
      ? `/settings/workspace/${workspaceId}/rule-review`
      : "/chat";
  }

  if (knowledgeIntent === "procedures") {
    return `/settings/workspace/${workspaceId}/procedures`;
  }

  return "/chat";
}
