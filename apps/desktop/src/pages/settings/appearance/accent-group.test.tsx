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
  it("renders the six accent options with the current one marked active", () => {
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
    expect(screen.getAllByRole("radio")).toHaveLength(6);
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
});
