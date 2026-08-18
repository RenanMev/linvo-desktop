import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@linvo/shared";

import { AccentGroup } from "@/pages/settings/appearance/accent-group";
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

describe("AccentGroup", () => {
  it("renders the preset accents plus Custom with the current one marked active", () => {
    mockAppearance({ accentColor: "purple" });
    render(<AccentGroup />);

    expect(screen.getByRole("radio", { name: "Roxo" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Azul" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getAllByRole("radio")).toHaveLength(7);
  });

  it("calls setPreference when another accent is clicked", async () => {
    const user = userEvent.setup();
    const setPreference = mockAppearance({ accentColor: "purple" });
    render(<AccentGroup />);

    await user.click(screen.getByRole("radio", { name: "Verde" }));

    expect(setPreference).toHaveBeenCalledWith("accentColor", "green");
  });

  it("marks a non-default accent as active when set", () => {
    mockAppearance({ accentColor: "rose" });
    render(<AccentGroup />);

    expect(screen.getByRole("radio", { name: "Rosa" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("shows the RGBA picker when Custom is active", () => {
    mockAppearance({ accentColor: "custom" });
    render(<AccentGroup />);

    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("R")).toBeInTheDocument();
    expect(screen.getByLabelText("G")).toBeInTheDocument();
    expect(screen.getByLabelText("B")).toBeInTheDocument();
    expect(screen.getByLabelText("A")).toBeInTheDocument();
  });

  it("selects Custom when the Custom swatch is clicked", async () => {
    const user = userEvent.setup();
    const setPreference = mockAppearance({ accentColor: "purple" });
    render(<AccentGroup />);

    await user.click(screen.getByRole("radio", { name: "Custom" }));

    expect(setPreference).toHaveBeenCalledWith("accentColor", "custom");
  });

  it("updates customAccentRgba when an RGBA channel is committed", async () => {
    const user = userEvent.setup();
    const setPreference = mockAppearance({
      accentColor: "custom",
      customAccentRgba: "rgba(124, 58, 237, 1)",
    });
    render(<AccentGroup />);

    const red = screen.getByLabelText("R");
    await user.clear(red);
    await user.type(red, "10");
    await user.tab();

    expect(setPreference).toHaveBeenCalledWith(
      "customAccentRgba",
      "rgba(10, 58, 237, 1)",
    );
  });
});
