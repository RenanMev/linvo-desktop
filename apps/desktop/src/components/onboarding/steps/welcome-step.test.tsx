import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";

describe("WelcomeStep", () => {
  it("focuses and activates the primary action", async () => {
    const pointer = userEvent.setup();
    const onContinue = vi.fn();
    render(<WelcomeStep onContinue={onContinue} />);

    const button = screen.getByRole("button", {
      name: "Começar configuração",
    });
    expect(button).toHaveFocus();

    await pointer.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
