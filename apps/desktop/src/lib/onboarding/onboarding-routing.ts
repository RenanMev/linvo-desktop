import { PANEL_HOME_ROUTE } from "@/lib/panel-routes";

export type OnboardingKnowledgeIntent = "rule-review" | "procedures" | null;

export function resolveOnboardingRoute(input: {
  workspaceId: string | null;
  knowledgeIntent: OnboardingKnowledgeIntent;
  candidateCount: number;
}): string {
  const { workspaceId, knowledgeIntent, candidateCount } = input;

  if (!workspaceId) {
    return PANEL_HOME_ROUTE;
  }

  if (knowledgeIntent === "rule-review") {
    return candidateCount > 0
      ? `/settings/workspace/${workspaceId}/rule-review`
      : PANEL_HOME_ROUTE;
  }

  if (knowledgeIntent === "procedures") {
    return `/settings/workspace/${workspaceId}/procedures`;
  }

  return PANEL_HOME_ROUTE;
}
