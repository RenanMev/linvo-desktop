import { describe, expect, it } from "vitest";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@linvo/shared";

import {
  applyAppearance,
  resolveCssVars,
  resolveEffectiveTheme,
  resolveHtmlAttrs,
  sanitizePreferences,
} from "./appearance-tokens";

/**
 * Este arquivo roda no projeto Vitest "unit" (ambiente node, sem DOM — ver
 * vitest.config.ts). `applyAppearance` só precisa de um objeto com a forma
 * mínima de HTMLElement que ele de fato usa; um stub evita depender de jsdom
 * numa suíte de lib pura.
 */
function makeFakeRoot() {
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  const styleProps = new Map<string, string>();

  return {
    classList: {
      toggle: (name: string, force: boolean) => {
        if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
      contains: (name: string) => classes.has(name),
    },
    setAttribute: (name: string, value: string) => attrs.set(name, value),
    getAttribute: (name: string) => attrs.get(name) ?? null,
    style: {
      setProperty: (name: string, value: string) => styleProps.set(name, value),
      getPropertyValue: (name: string) => styleProps.get(name) ?? "",
    },
  } as unknown as HTMLElement;
}

function makePrefs(
  overrides: Partial<AppearancePreferences> = {},
): AppearancePreferences {
  return {
    ...APPEARANCE_DEFAULTS,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveEffectiveTheme", () => {
  it("resolves system to dark when the OS prefers dark", () => {
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
  });

  it("resolves system to light when the OS prefers light", () => {
    expect(resolveEffectiveTheme("system", false)).toBe("light");
  });

  it("ignores the OS signal for an explicit light choice", () => {
    expect(resolveEffectiveTheme("light", true)).toBe("light");
  });

  it("ignores the OS signal for an explicit dark choice", () => {
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
  });
});

describe("resolveHtmlAttrs", () => {
  it("falls back to the OS reduced-motion signal when reduceMotion is null", () => {
    const prefs = makePrefs({ reduceMotion: null });
    expect(resolveHtmlAttrs(prefs, "dark", true).reduceMotion).toBe(true);
    expect(resolveHtmlAttrs(prefs, "dark", false).reduceMotion).toBe(false);
  });

  it("lets an explicit true override the OS signal", () => {
    const prefs = makePrefs({ reduceMotion: true });
    expect(resolveHtmlAttrs(prefs, "dark", false).reduceMotion).toBe(true);
  });

  it("lets an explicit false override the OS signal", () => {
    const prefs = makePrefs({ reduceMotion: false });
    expect(resolveHtmlAttrs(prefs, "dark", true).reduceMotion).toBe(false);
  });

  it("passes the blur level through untouched", () => {
    const prefs = makePrefs({ blurLevel: "strong" });
    expect(resolveHtmlAttrs(prefs, "dark", false).blur).toBe("strong");
  });

  it("derives dark from the effective theme, not themeMode directly", () => {
    const prefs = makePrefs({ themeMode: "system" });
    expect(resolveHtmlAttrs(prefs, "light", false).dark).toBe(false);
    expect(resolveHtmlAttrs(prefs, "dark", false).dark).toBe(true);
  });
});

describe("resolveCssVars", () => {
  it("clamps panelOpacity below 55 on read", () => {
    const prefs = makePrefs({ panelOpacity: 10 });
    expect(resolveCssVars(prefs, "dark")["--panel-tint"]).toBe(
      "rgba(10, 10, 10, 0.55)",
    );
  });

  it("clamps panelOpacity above 100 on read", () => {
    const prefs = makePrefs({ panelOpacity: 500 });
    expect(resolveCssVars(prefs, "dark")["--panel-tint"]).toBe(
      "rgba(10, 10, 10, 1)",
    );
  });

  it("uses the dark rgb base for --panel-tint in dark theme", () => {
    const prefs = makePrefs({ panelOpacity: 72 });
    expect(resolveCssVars(prefs, "dark")["--panel-tint"]).toBe(
      "rgba(10, 10, 10, 0.72)",
    );
  });

  it("uses the light rgb base for --panel-tint in light theme", () => {
    const prefs = makePrefs({ panelOpacity: 72 });
    expect(resolveCssVars(prefs, "light")["--panel-tint"]).toBe(
      "rgba(250, 249, 248, 0.72)",
    );
  });

  it("maps responseFont serif to the editorial font family var", () => {
    const prefs = makePrefs({ responseFont: "serif" });
    expect(resolveCssVars(prefs, "dark")["--editorial-font-family"]).toBe(
      "var(--font-editorial)",
    );
  });

  it("maps responseFont interface to the interface font family var", () => {
    const prefs = makePrefs({ responseFont: "interface" });
    expect(resolveCssVars(prefs, "dark")["--editorial-font-family"]).toBe(
      "var(--font-interface)",
    );
  });

  it("produces distinct gap values for compact vs comfortable density", () => {
    const compact = resolveCssVars(makePrefs({ uiDensity: "compact" }), "dark");
    const comfortable = resolveCssVars(
      makePrefs({ uiDensity: "comfortable" }),
      "dark",
    );
    expect(compact["--chat-message-gap"]).not.toBe(
      comfortable["--chat-message-gap"],
    );
  });
});

describe("sanitizePreferences", () => {
  it("returns full defaults for null input", () => {
    expect(sanitizePreferences(null)).toMatchObject(APPEARANCE_DEFAULTS);
  });

  it("falls back only the invalid field, preserving the rest", () => {
    const result = sanitizePreferences({
      themeMode: "dark",
      blurLevel: "ultra" as never,
      panelOpacity: 90,
    });

    expect(result.themeMode).toBe("dark");
    expect(result.panelOpacity).toBe(90);
    expect(result.blurLevel).toBe(APPEARANCE_DEFAULTS.blurLevel);
  });

  it("clamps an out-of-range panelOpacity instead of discarding it", () => {
    const result = sanitizePreferences({ panelOpacity: 5 });
    expect(result.panelOpacity).toBe(55);
  });
});

describe("applyAppearance", () => {
  it("toggles the dark class on the root element", () => {
    const root = makeFakeRoot();
    applyAppearance(root, makePrefs({ themeMode: "dark" }), {
      prefersDark: false,
      prefersReducedMotion: false,
    });
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("sets data-blur and data-reduce-motion attributes", () => {
    const root = makeFakeRoot();
    applyAppearance(root, makePrefs({ blurLevel: "off", reduceMotion: true }), {
      prefersDark: false,
      prefersReducedMotion: false,
    });
    expect(root.getAttribute("data-blur")).toBe("off");
    expect(root.getAttribute("data-reduce-motion")).toBe("true");
  });

  it("writes CSS custom properties onto the root style", () => {
    const root = makeFakeRoot();
    applyAppearance(root, makePrefs({ panelOpacity: 80 }), {
      prefersDark: true,
      prefersReducedMotion: false,
    });
    expect(root.style.getPropertyValue("--panel-tint")).toBe(
      "rgba(10, 10, 10, 0.8)",
    );
  });
});
