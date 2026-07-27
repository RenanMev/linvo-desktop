import { describe, expect, it } from "vitest";
import { APPEARANCE_DEFAULTS } from "@linvo/shared";

import { computeBootAttrs } from "./appearance-boot";

describe("computeBootAttrs", () => {
  it("falls back to system + defaults when nothing is stored", () => {
    const attrs = computeBootAttrs(null, {
      prefersDark: true,
      prefersReducedMotion: false,
    });

    expect(attrs.dark).toBe(true);
    expect(attrs.blur).toBe(APPEARANCE_DEFAULTS.blurLevel);
    expect(attrs.reduceMotion).toBe(false);
  });

  it("follows the OS dark preference when themeMode is system and nothing is stored", () => {
    expect(
      computeBootAttrs(null, { prefersDark: false, prefersReducedMotion: false })
        .dark,
    ).toBe(false);
    expect(
      computeBootAttrs(null, { prefersDark: true, prefersReducedMotion: false })
        .dark,
    ).toBe(true);
  });

  it("respects an explicit stored theme regardless of the OS signal", () => {
    const raw = JSON.stringify({
      version: 1,
      prefs: { ...APPEARANCE_DEFAULTS, themeMode: "dark", updatedAt: "2026-01-01T00:00:00.000Z" },
      pendingSync: false,
    });

    const attrs = computeBootAttrs(raw, {
      prefersDark: false,
      prefersReducedMotion: false,
    });

    expect(attrs.dark).toBe(true);
  });

  it("respects the stored blur level", () => {
    const raw = JSON.stringify({
      version: 1,
      prefs: { ...APPEARANCE_DEFAULTS, blurLevel: "off", updatedAt: "2026-01-01T00:00:00.000Z" },
      pendingSync: false,
    });

    const attrs = computeBootAttrs(raw, {
      prefersDark: false,
      prefersReducedMotion: false,
    });

    expect(attrs.blur).toBe("off");
  });

  it("falls back to defaults without throwing on corrupted JSON", () => {
    expect(() =>
      computeBootAttrs("{ not valid json", {
        prefersDark: false,
        prefersReducedMotion: false,
      }),
    ).not.toThrow();

    const attrs = computeBootAttrs("{ not valid json", {
      prefersDark: false,
      prefersReducedMotion: false,
    });
    expect(attrs.blur).toBe(APPEARANCE_DEFAULTS.blurLevel);
  });

  it("falls back to defaults on an unknown envelope version", () => {
    const raw = JSON.stringify({
      version: 99,
      prefs: { ...APPEARANCE_DEFAULTS, blurLevel: "strong" },
      pendingSync: false,
    });

    const attrs = computeBootAttrs(raw, {
      prefersDark: false,
      prefersReducedMotion: false,
    });

    expect(attrs.blur).toBe(APPEARANCE_DEFAULTS.blurLevel);
  });

  it("lets an explicit reduceMotion: false override a reduced-motion OS signal", () => {
    const raw = JSON.stringify({
      version: 1,
      prefs: { ...APPEARANCE_DEFAULTS, reduceMotion: false, updatedAt: "2026-01-01T00:00:00.000Z" },
      pendingSync: false,
    });

    const attrs = computeBootAttrs(raw, {
      prefersDark: false,
      prefersReducedMotion: true,
    });

    expect(attrs.reduceMotion).toBe(false);
  });
});
