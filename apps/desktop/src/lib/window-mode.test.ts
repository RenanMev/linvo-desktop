import { describe, expect, it } from "vitest";

import {
  CHECKLIST_SIZE,
  COMPACT_SIZE,
  envelopePositionForPill,
  ISLAND_ENVELOPE_PAD,
  ISLAND_COMPACT_RADIUS_PX,
  ISLAND_ENVELOPE_SIZE,
  ISLAND_EXPANDED_RADIUS_PX,
  islandRectForMode,
  PANEL_SIZE,
  pillPositionForEnvelope,
  QUICK_MENU_SIZE,
  radiusForEnvelopeMode,
  resolveIslandGrowthDirection,
  resolveIslandGrowthShift,
  unionRect,
} from "@/lib/window-mode";

describe("window sizes", () => {
  it("defines compact bar dimensions", () => {
    expect(COMPACT_SIZE).toEqual({ width: 200, height: 38 });
  });

  it("defines panel dimensions", () => {
    expect(PANEL_SIZE).toEqual({ width: 1200, height: 800 });
  });

  it("defines quick-menu dimensions", () => {
    expect(QUICK_MENU_SIZE).toEqual({ width: 380, height: 520 });
  });
});

describe("island envelope", () => {
  it("fits the largest mode plus padding on both axes", () => {
    expect(ISLAND_ENVELOPE_SIZE).toEqual({
      width: QUICK_MENU_SIZE.width + ISLAND_ENVELOPE_PAD * 2,
      height: QUICK_MENU_SIZE.height + ISLAND_ENVELOPE_PAD * 2,
    });
  });

  it("centers every mode on the horizontal axis", () => {
    for (const mode of ["compact", "quick-menu", "checklist"] as const) {
      const rect = islandRectForMode(mode);
      expect(rect.x + rect.width / 2).toBeCloseTo(ISLAND_ENVELOPE_SIZE.width / 2, 5);
    }
  });

  it("anchors quick-menu to the padding on both growth directions", () => {
    expect(islandRectForMode("quick-menu", "down")).toEqual({
      x: ISLAND_ENVELOPE_PAD,
      y: ISLAND_ENVELOPE_PAD,
      ...QUICK_MENU_SIZE,
    });
    expect(islandRectForMode("quick-menu", "up")).toEqual({
      x: ISLAND_ENVELOPE_PAD,
      y: ISLAND_ENVELOPE_PAD,
      ...QUICK_MENU_SIZE,
    });
  });

  it("anchors compact to the top when growing down and to the bottom when growing up", () => {
    const down = islandRectForMode("compact", "down");
    const up = islandRectForMode("compact", "up");

    expect(down).toEqual({ x: 114, y: ISLAND_ENVELOPE_PAD, ...COMPACT_SIZE });
    expect(up).toEqual({
      x: 114,
      y: ISLAND_ENVELOPE_SIZE.height - ISLAND_ENVELOPE_PAD - COMPACT_SIZE.height,
      ...COMPACT_SIZE,
    });
  });

  it("anchors checklist to the top when growing down and to the bottom when growing up", () => {
    const down = islandRectForMode("checklist", "down");
    const up = islandRectForMode("checklist", "up");

    expect(down).toEqual({ x: 70, y: ISLAND_ENVELOPE_PAD, ...CHECKLIST_SIZE });
    expect(up).toEqual({
      x: 70,
      y: ISLAND_ENVELOPE_SIZE.height - ISLAND_ENVELOPE_PAD - CHECKLIST_SIZE.height,
      ...CHECKLIST_SIZE,
    });
  });

  it("reports zero growth shift for the tallest mode", () => {
    // quick-menu já ocupa a altura inteira menos o padding dos dois lados —
    // não há folga para a âncora vertical mudar entre "down" e "up".
    expect(resolveIslandGrowthShift("quick-menu")).toBe(0);
  });

  it("reports a negative growth shift for shorter modes", () => {
    // Negativo: crescer para cima exige que o envelope suba na tela (y menor).
    expect(resolveIslandGrowthShift("compact")).toBeLessThan(0);
    expect(resolveIslandGrowthShift("checklist")).toBeLessThan(0);
  });

  it("keeps the on-screen rect stable when the envelope shifts by resolveIslandGrowthShift", () => {
    for (const mode of ["compact", "checklist"] as const) {
      const shift = resolveIslandGrowthShift(mode);
      const down = islandRectForMode(mode, "down");
      const up = islandRectForMode(mode, "up");

      // Se o envelope sobe `shift` px ao trocar para "up", o retângulo em tela
      // (envelopeY + rect.y) tem que continuar igual ao de "down" com envelope
      // parado em 0.
      expect(up.y + shift).toBe(down.y);
    }
  });

  describe("growth direction", () => {
    const monitor = { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } };

    it("defaults to down without a known work area", () => {
      expect(
        resolveIslandGrowthDirection({ pillPosition: { x: 100, y: 900 }, workArea: null }),
      ).toBe("down");
    });

    it("grows down when the tallest mode fits below the pill", () => {
      expect(
        resolveIslandGrowthDirection({
          pillPosition: { x: 100, y: 100 },
          workArea: monitor,
        }),
      ).toBe("down");
    });

    it("grows up when the tallest mode only fits above the pill", () => {
      expect(
        resolveIslandGrowthDirection({
          pillPosition: { x: 100, y: 996 },
          workArea: monitor,
        }),
      ).toBe("up");
    });

    it("picks the side with more room when the tallest mode fits neither way", () => {
      const shortMonitor = { position: { x: 0, y: 0 }, size: { width: 1920, height: 300 } };

      expect(
        resolveIslandGrowthDirection({
          pillPosition: { x: 100, y: 50 },
          workArea: shortMonitor,
        }),
      ).toBe("down");

      expect(
        resolveIslandGrowthDirection({
          pillPosition: { x: 100, y: 200 },
          workArea: shortMonitor,
        }),
      ).toBe("up");
    });

    it("scales the height thresholds for physical-pixel callers", () => {
      // A 2x físico: 700px físicos de folga abaixo da pílula é MENOS que o
      // quick-menu físico (520 * 2 = 1040), mas MAIS que o valor lógico cru
      // (520) — comparar sem escalar erraria para "down".
      const physicalMonitor = {
        position: { x: 0, y: 0 },
        size: { width: 3840, height: 2160 },
      };
      const pillPosition = { x: 200, y: 1392 };

      expect(
        resolveIslandGrowthDirection({
          pillPosition,
          workArea: physicalMonitor,
          scaleFactor: 2,
        }),
      ).toBe("up");
      expect(
        resolveIslandGrowthDirection({ pillPosition, workArea: physicalMonitor }),
      ).toBe("down");
    });
  });

  describe("pill <-> envelope position conversion", () => {
    it("moves the envelope up-left of the pill by the compact anchor", () => {
      expect(
        envelopePositionForPill({ pillPosition: { x: 500, y: 300 }, growth: "down" }),
      ).toEqual({ x: 500 - 114, y: 300 - ISLAND_ENVELOPE_PAD });
    });

    it("round-trips pill -> envelope -> pill for both growth directions", () => {
      const pillPosition = { x: 742, y: 358 };
      for (const growth of ["down", "up"] as const) {
        const envelopePosition = envelopePositionForPill({ pillPosition, growth });
        expect(pillPositionForEnvelope({ envelopePosition, growth })).toEqual(pillPosition);
      }
    });

    it("scales the compact anchor by scaleFactor for physical-pixel callers", () => {
      // A 1.5x, o offset lógico de 130px vira 195 físicos — sem o fator, um
      // caller nativo (bounds em físico) posicionaria o envelope 65px errado.
      expect(
        envelopePositionForPill({
          pillPosition: { x: 1000, y: 600 },
          growth: "down",
          scaleFactor: 1.5,
        }),
      ).toEqual({ x: 1000 - 114 * 1.5, y: 600 - ISLAND_ENVELOPE_PAD * 1.5 });
    });

    it("round-trips through a non-1 scaleFactor", () => {
      const pillPosition = { x: 1180, y: 537 };
      for (const growth of ["down", "up"] as const) {
        const envelopePosition = envelopePositionForPill({
          pillPosition,
          growth,
          scaleFactor: 1.25,
        });
        expect(
          pillPositionForEnvelope({ envelopePosition, growth, scaleFactor: 1.25 }),
        ).toEqual(pillPosition);
      }
    });
  });

  describe("radiusForEnvelopeMode", () => {
    it("uses the compact radius for compact, not half its height", () => {
      // Metade da altura desenharia uma cápsula; o desenho é um retângulo
      // arredondado, então o raio é um valor próprio e menor.
      expect(radiusForEnvelopeMode("compact")).toBe(ISLAND_COMPACT_RADIUS_PX);
      expect(ISLAND_COMPACT_RADIUS_PX).toBeLessThan(COMPACT_SIZE.height / 2);
    });

    it("uses the expanded radius for the panel modes", () => {
      expect(radiusForEnvelopeMode("quick-menu")).toBe(ISLAND_EXPANDED_RADIUS_PX);
      expect(radiusForEnvelopeMode("checklist")).toBe(ISLAND_EXPANDED_RADIUS_PX);
    });
  });

  describe("unionRect", () => {
    it("covers both rects exactly when one contains the other", () => {
      const outer = { x: 0, y: 0, width: 100, height: 100 };
      const inner = { x: 20, y: 20, width: 10, height: 10 };
      expect(unionRect(outer, inner)).toEqual(outer);
      expect(unionRect(inner, outer)).toEqual(outer);
    });

    it("spans two disjoint rects", () => {
      const a = { x: 0, y: 0, width: 10, height: 10 };
      const b = { x: 50, y: 40, width: 10, height: 10 };
      expect(unionRect(a, b)).toEqual({ x: 0, y: 0, width: 60, height: 50 });
    });

    it("covers the compact and quick-menu rects at rest", () => {
      const compact = islandRectForMode("compact");
      const quickMenu = islandRectForMode("quick-menu");
      expect(unionRect(compact, quickMenu)).toEqual(quickMenu);
    });
  });
});
