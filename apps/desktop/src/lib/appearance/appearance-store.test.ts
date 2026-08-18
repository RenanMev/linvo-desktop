import { beforeEach, describe, expect, it } from "vitest";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@linvo/shared";

import {
  APPEARANCE_STORAGE_KEY,
  clearStoredAppearance,
  hasPendingSync,
  loadStoredAppearance,
  markPendingSync,
  saveStoredAppearance,
} from "./appearance-store";

function makePrefs(
  overrides: Partial<AppearancePreferences> = {},
): AppearancePreferences {
  return {
    ...APPEARANCE_DEFAULTS,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("appearance-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(loadStoredAppearance()).toBeNull();
  });

  it("round-trips preferences saved through saveStoredAppearance", () => {
    const prefs = makePrefs({ themeMode: "dark", panelOpacity: 88 });
    saveStoredAppearance(prefs);

    expect(loadStoredAppearance()).toEqual({
      version: 1,
      prefs,
      pendingSync: false,
    });
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, "{ broken");
    expect(loadStoredAppearance()).toBeNull();
  });

  it("returns null for an unknown envelope version", () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ version: 99, prefs: makePrefs(), pendingSync: false }),
    );
    expect(loadStoredAppearance()).toBeNull();
  });

  it("returns null when prefs fail schema validation", () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        prefs: { ...makePrefs(), blurLevel: "ultra" },
        pendingSync: false,
      }),
    );
    expect(loadStoredAppearance()).toBeNull();
  });

  it("fills missing customAccentRgba from schema default", () => {
    const { customAccentRgba: _customAccentRgba, ...legacyPrefs } = makePrefs({
      accentColor: "blue",
    });
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        prefs: legacyPrefs,
        pendingSync: false,
      }),
    );

    const stored = loadStoredAppearance();
    expect(stored?.prefs.accentColor).toBe("blue");
    expect(stored?.prefs.customAccentRgba).toBe(
      APPEARANCE_DEFAULTS.customAccentRgba,
    );
  });

  it("clears the stored envelope", () => {
    saveStoredAppearance(makePrefs());
    clearStoredAppearance();
    expect(loadStoredAppearance()).toBeNull();
  });

  it("round-trips the pendingSync flag", () => {
    saveStoredAppearance(makePrefs());
    expect(hasPendingSync()).toBe(false);

    markPendingSync(true);
    expect(hasPendingSync()).toBe(true);

    markPendingSync(false);
    expect(hasPendingSync()).toBe(false);
  });

  it("preserves the existing pendingSync flag when prefs are re-saved", () => {
    saveStoredAppearance(makePrefs());
    markPendingSync(true);

    saveStoredAppearance(makePrefs({ panelOpacity: 60 }));

    expect(hasPendingSync()).toBe(true);
    expect(loadStoredAppearance()?.prefs.panelOpacity).toBe(60);
  });

  it("reports no pending sync when nothing is stored", () => {
    expect(hasPendingSync()).toBe(false);
  });

  it("does not throw when marking pending sync with nothing stored", () => {
    expect(() => markPendingSync(true)).not.toThrow();
    expect(loadStoredAppearance()).toBeNull();
  });
});
