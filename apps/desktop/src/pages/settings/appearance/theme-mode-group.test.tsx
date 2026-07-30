import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@linvo/shared";

import { ThemeModeGroup } from "@/pages/settings/appearance/theme-mode-group";
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

describe("ThemeModeGroup", () => {
  it("renders the three theme options with the current one marked active", () => {
    mockAppearance({ themeMode: "system" });
    render(<ThemeModeGroup />);

    expect(screen.getByRole("radio", { name: "Sistema" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Claro" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("calls setPreference when another theme is clicked", async () => {
    const user = userEvent.setup();
    const setPreference = mockAppearance({ themeMode: "system" });
    render(<ThemeModeGroup />);

    await user.click(screen.getByRole("radio", { name: "Escuro" }));

    expect(setPreference).toHaveBeenCalledWith("themeMode", "dark");
  });
});
