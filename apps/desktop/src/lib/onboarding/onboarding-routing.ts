export type OnboardingKnowledgeIntent = "rule-review" | "procedures" | null;

/*
 * Onde o onboarding termina. `null` = na ilha, sem abrir o painel: o live é
 * a barra, e o tour acaba nela. Só há rota quando existe algo que precisa
 * do painel de verdade (revisar regras encontradas, autorar procedimentos).
 */
export type OnboardingRoute = string | null;

export function resolveOnboardingRoute(input: {
  workspaceId: string | null;
  knowledgeIntent: OnboardingKnowledgeIntent;
  candidateCount: number;
}): OnboardingRoute {
  const { workspaceId, knowledgeIntent, candidateCount } = input;

  if (!workspaceId) {
    return null;
  }

  if (knowledgeIntent === "rule-review") {
    return candidateCount > 0
      ? `/settings/workspace/${workspaceId}/rule-review`
      : null;
  }

  if (knowledgeIntent === "procedures") {
    return `/settings/workspace/${workspaceId}/procedures`;
  }

  return null;
}
