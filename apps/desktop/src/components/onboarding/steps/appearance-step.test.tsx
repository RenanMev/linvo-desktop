import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/pages/settings/appearance/theme-mode-group", () => ({
  ThemeModeGroup: () => <div>Tema</div>,
}));

vi.mock("@/pages/settings/appearance/accent-group", () => ({
  AccentGroup: () => <div>Cor de destaque</div>,
}));

import { AppearanceStep } from "@/components/onboarding/steps/appearance-step";

describe("AppearanceStep", () => {
  it("renders both preference groups and continues", async () => {
    const pointer = userEvent.setup();
    const onContinue = vi.fn();
    render(<AppearanceStep busy={false} onContinue={onContinue} />);

    expect(screen.getByText("Tema")).toBeInTheDocument();
    expect(screen.getByText("Cor de destaque")).toBeInTheDocument();

    await pointer.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
