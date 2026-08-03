import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@linvo/shared";

import { SurfaceGroup } from "@/pages/settings/appearance/surface-group";
import { useAppearance } from "@/context/appearance-context";

vi.mock("@/context/appearance-context", () => ({
  useAppearance: vi.fn(),
}));

function makePrefs(
  overrides: Partial<AppearancePreferences> = {},
): AppearancePreferences {
  return {
    ...APPEARANCE_DEFAULTS,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockAppearance(
  overrides: Partial<AppearancePreferences> = {},
  setPreference = vi.fn(),
) {
  vi.mocked(useAppearance).mockReturnValue({
    preferences: makePrefs(overrides),
    setPreference,
    resetToDefaults: vi.fn(),
    isSyncing: false,
  });
  return setPreference;
}

describe("SurfaceGroup", () => {
  it("shows the current opacity value", () => {
    mockAppearance({ panelOpacity: 82 });
    render(<SurfaceGroup />);
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("clamps the slider range to 55-100", () => {
    mockAppearance({ panelOpacity: 72 });
    render(<SurfaceGroup />);
    const slider = screen.getByLabelText("Opacidade do painel");
    expect(slider).toHaveAttribute("min", "55");
    expect(slider).toHaveAttribute("max", "100");
  });

  it("calls setPreference when the opacity slider changes", () => {
    const setPreference = mockAppearance({ panelOpacity: 72 });
    render(<SurfaceGroup />);

    const slider = screen.getByLabelText("Opacidade do painel");
    fireChange(slider, "90");

    expect(setPreference).toHaveBeenCalledWith("panelOpacity", 90);
  });

  it("renders the four blur levels with the current one marked active", () => {
    mockAppearance({ blurLevel: "strong" });
    render(<SurfaceGroup />);

    expect(screen.getByRole("button", { name: "Forte" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Desligado" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls setPreference when a blur level is clicked", async () => {
    const user = userEvent.setup();
    const setPreference = mockAppearance({ blurLevel: "medium" });
    render(<SurfaceGroup />);

    await user.click(screen.getByRole("button", { name: "Desligado" }));

    expect(setPreference).toHaveBeenCalledWith("blurLevel", "off");
  });

  it("shows a low-contrast warning when opacity is low and blur is off", () => {
    mockAppearance({ panelOpacity: 60, blurLevel: "off" });
    render(<SurfaceGroup />);

    expect(screen.getByRole("status")).toHaveTextContent(/legibilidade/i);
  });

  it("does not show the warning when blur is enabled, even with low opacity", () => {
    mockAppearance({ panelOpacity: 60, blurLevel: "light" });
    render(<SurfaceGroup />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

function fireChange(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
