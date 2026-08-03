import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OnboardingRail } from "@/components/onboarding/onboarding-rail";
import {
  ONBOARDING_STEP_ORDER,
  resolveStepStates,
} from "@/lib/onboarding/onboarding-steps";

function makeSteps() {
  return resolveStepStates({
    currentStepId: "context",
    completedIds: new Set(["welcome", "workspace"]),
    skippedIds: new Set(),
  });
}

describe("OnboardingRail", () => {
  it("renders all seven steps and marks the current one", () => {
    render(
      <OnboardingRail
        steps={makeSteps()}
        currentStepId="context"
        onSelect={vi.fn()}
        forced={false}
      />,
    );

    expect(
      screen.getAllByRole("button", { hidden: true }),
    ).toHaveLength(ONBOARDING_STEP_ORDER.length);
    expect(screen.getByRole("button", { name: /Contexto/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("navigates only to completed or skipped steps", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const steps = resolveStepStates({
      currentStepId: "context",
      completedIds: new Set(["welcome"]),
      skippedIds: new Set(["workspace"]),
    });
    render(
      <OnboardingRail
        steps={steps}
        currentStepId="context"
        onSelect={onSelect}
        forced={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Boas-vindas/ }));
    await user.click(screen.getByRole("button", { name: /Workspace/ }));
    await user.click(screen.getByRole("button", { name: /Conhecimento/ }));

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, "welcome");
    expect(onSelect).toHaveBeenNthCalledWith(2, "workspace");
    expect(
      screen.getByRole("button", { name: /Conhecimento/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the forced mode marker", () => {
    render(
      <OnboardingRail
        steps={makeSteps()}
        currentStepId="context"
        onSelect={vi.fn()}
        forced
      />,
    );

    expect(screen.getByText("Modo forçado")).toBeInTheDocument();
  });
});
