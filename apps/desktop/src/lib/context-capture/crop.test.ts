import { describe, expect, it } from "vitest";

import {
  clampRectToBounds,
  isRectUsable,
  normalizeRect,
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

describe("isRectUsable", () => {
  it("rejects the few-pixel rect left behind by a plain click", () => {
    expect(isRectUsable({ x: 0, y: 0, width: 3, height: 2 })).toBe(false);
  });

  it("accepts a deliberate selection", () => {
    expect(isRectUsable({ x: 0, y: 0, width: 120, height: 80 })).toBe(true);
  });
});
