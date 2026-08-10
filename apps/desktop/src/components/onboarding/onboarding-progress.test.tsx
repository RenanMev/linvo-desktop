import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { resolveStepStates } from "@/lib/onboarding/onboarding-steps";

function makeSteps() {
  return resolveStepStates({
    currentStepId: "context",
    completedIds: new Set(["welcome"] as const),
    skippedIds: new Set(["workspace"] as const),
  });
}

describe("OnboardingProgress", () => {
  it("announces the position in the flow", () => {
    render(<OnboardingProgress steps={makeSteps()} currentStepId="context" />);

    expect(screen.getByText("Etapa 3 de 7")).toBeInTheDocument();
  });

  it("shows the forced mode marker only when forced", () => {
    const { rerender } = render(
      <OnboardingProgress steps={makeSteps()} currentStepId="context" />,
    );
    expect(screen.queryByText("Modo forçado")).toBeNull();

    rerender(
      <OnboardingProgress steps={makeSteps()} currentStepId="context" forced />,
    );
    expect(screen.getByText("Modo forçado")).toBeInTheDocument();
  });
});
