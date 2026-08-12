import { describe, expect, it } from "vitest";

import {
  clampRectToBounds,
  isRectUsable,
  normalizeRect,
  pickSnapTarget,
  scalePointToSource,
  scaleRectToDisplay,
  scaleRectToSource,
} from "@/lib/context-capture/crop";

describe("normalizeRect", () => {
  it("handles a top-left to bottom-right drag", () => {
    expect(normalizeRect({ x: 10, y: 20 }, { x: 110, y: 220 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 200,
    });
  });

  it("handles a reversed drag without negative sizes", () => {
    expect(normalizeRect({ x: 110, y: 220 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 200,
    });
  });
});

describe("clampRectToBounds", () => {
  it("keeps a rect that already fits", () => {
    const rect = { x: 5, y: 5, width: 50, height: 50 };
    expect(clampRectToBounds(rect, { width: 100, height: 100 })).toEqual(rect);
  });

  it("trims a rect that overflows the bounds", () => {
    expect(
      clampRectToBounds(
        { x: 80, y: 80, width: 50, height: 50 },
        { width: 100, height: 100 },
      ),
    ).toEqual({ x: 80, y: 80, width: 20, height: 20 });
  });

  it("collapses a rect that starts outside the bounds", () => {
    expect(
      clampRectToBounds(
        { x: -50, y: -50, width: 20, height: 20 },
        { width: 100, height: 100 },
      ),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("scaleRectToSource", () => {
  it("maps preview coordinates onto the original frame", () => {
    expect(
      scaleRectToSource(
        { x: 50, y: 25, width: 100, height: 50 },
        { width: 400, height: 200 },
        { width: 1600, height: 800 },
      ),
    ).toEqual({ x: 200, y: 100, width: 400, height: 200 });
  });

  it("never returns a rect outside the source after rounding", () => {
    const rect = scaleRectToSource(
      { x: 0, y: 0, width: 400, height: 200 },
      { width: 400, height: 200 },
      { width: 1601, height: 801 },
    );

    expect(rect.x + rect.width).toBeLessThanOrEqual(1601);
    expect(rect.y + rect.height).toBeLessThanOrEqual(801);
  });

  it("returns an empty rect when the preview has no size yet", () => {
    expect(
      scaleRectToSource(
        { x: 0, y: 0, width: 10, height: 10 },
        { width: 0, height: 0 },
        { width: 100, height: 100 },
      ),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("scaleRectToDisplay", () => {
  it("brings a frame rect back to the displayed element", () => {
    // 150% de escala: 2400 px físicos ocupam 1600 px CSS.
    expect(
      scaleRectToDisplay(
        { x: 300, y: 150, width: 600, height: 300 },
        { width: 2400, height: 1200 },
        { width: 1600, height: 800 },
      ),
    ).toEqual({ x: 200, y: 100, width: 400, height: 200 });
  });

  it("round-trips with scaleRectToSource", () => {
    const source = { width: 2400, height: 1200 };
    const display = { width: 1600, height: 800 };
    const rect = { x: 200, y: 100, width: 400, height: 200 };

    expect(
      scaleRectToDisplay(
        scaleRectToSource(rect, display, source),
        source,
        display,
      ),
    ).toEqual(rect);
  });

  it("returns an empty rect when the frame has no size", () => {
    expect(
      scaleRectToDisplay(
        { x: 0, y: 0, width: 10, height: 10 },
        { width: 0, height: 0 },
        { width: 100, height: 100 },
      ),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("scalePointToSource", () => {
  it("converts a CSS pointer position into frame pixels", () => {
    expect(
      scalePointToSource(
        { x: 800, y: 400 },
        { width: 1600, height: 800 },
        { width: 2400, height: 1200 },
      ),
    ).toEqual({ x: 1200, y: 600 });
  });

  it("returns the origin before the element has been measured", () => {
    expect(
      scalePointToSource(
        { x: 10, y: 10 },
        { width: 0, height: 0 },
        { width: 100, height: 100 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("pickSnapTarget", () => {
  const windowRect = {
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    kind: "window" as const,
  };
  const screen1 = {
    x: 0,
    y: 0,
    width: 1000,
    height: 800,
    kind: "monitor" as const,
  };
  const screen2 = {
    x: 1000,
    y: 0,
    width: 800,
    height: 600,
    kind: "monitor" as const,
  };
  const targets = [windowRect, screen1, screen2];

  it("prefers a window over the monitor behind it", () => {
    expect(pickSnapTarget({ x: 200, y: 200 }, targets)).toBe(windowRect);
  });

  it("falls back to the monitor under the pointer", () => {
    expect(pickSnapTarget({ x: 900, y: 700 }, targets)).toBe(screen1);
  });

  it("resolves the second monitor by its offset", () => {
    expect(pickSnapTarget({ x: 1400, y: 300 }, targets)).toBe(screen2);
  });

  it("takes the topmost window when they overlap", () => {
    const above = { ...windowRect, x: 150, kind: "window" as const };
    // EnumWindows entrega do topo para o fundo, então a ordem já é a resposta.
    expect(pickSnapTarget({ x: 200, y: 200 }, [above, windowRect])).toBe(above);
  });

  it("returns null outside every target", () => {
    expect(pickSnapTarget({ x: 5000, y: 5000 }, targets)).toBeNull();
  });
});

describe("isRectUsable", () => {
  it("rejects the few-pixel rect left behind by a plain click", () => {
    expect(isRectUsable({ x: 0, y: 0, width: 3, height: 2 })).toBe(false);
  });

  it("accepts a deliberate selection", () => {
    expect(isRectUsable({ x: 0, y: 0, width: 120, height: 80 })).toBe(true);
  });
});
