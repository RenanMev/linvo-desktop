import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    shortcutDone: false,
    dragDone: false,
    shortcutUnavailable: false,
  },
}));

vi.mock("@/hooks/use-onboarding-bar-tour", () => ({
  useOnboardingBarTour: () => mocks.state,
}));

import { BarTourStep } from "@/components/onboarding/steps/bar-tour-step";

describe("BarTourStep", () => {
  beforeEach(() => {
    mocks.state.shortcutDone = false;
    mocks.state.dragDone = false;
    mocks.state.shortcutUnavailable = false;
  });

  it("reflects both completed gestures", () => {
    mocks.state.shortcutDone = true;
    mocks.state.dragDone = true;

    render(<BarTourStep onContinue={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(screen.getAllByText(/Acione|Arraste/)).toHaveLength(2);
  });

  it("shows the unavailable warning without blocking progress", async () => {
    const pointer = userEvent.setup();
    const onContinue = vi.fn();
    mocks.state.shortcutUnavailable = true;

    render(<BarTourStep onContinue={onContinue} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Outro aplicativo pode estar usando esse atalho",
    );
    await pointer.click(screen.getByRole("button", { name: "Já entendi" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
