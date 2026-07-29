import { describe, expect, it } from "vitest";

import {
  applyAnchor,
  isAnchored,
  parseAnchor,
  resolveSnap,
  serializeAnchor,
  type EdgeAnchor,
} from "@/lib/window-anchor";
import type { MonitorInfo } from "@/lib/window-position";

const workArea: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1040 },
};

const size = { width: 168, height: 34 };

describe("resolveSnap", () => {
  it("snaps to the left edge when within threshold", () => {
    const result = resolveSnap({
      position: { x: 10, y: 400 },
      size,
      workArea,
      threshold: 40,
    });
    expect(result.anchor).toEqual({ horizontal: "left", vertical: null });
    expect(result.position.x).toBe(0);
    expect(result.position.y).toBe(400);
  });

  it("snaps to the right edge when within threshold", () => {
    const result = resolveSnap({
      position: { x: 1920 - 168 - 15, y: 400 },
      size,
      workArea,
      threshold: 40,
    });
    expect(result.anchor).toEqual({ horizontal: "right", vertical: null });
    expect(result.position.x).toBe(1920 - 168);
  });

  it("snaps to the top edge when within threshold", () => {
    const result = resolveSnap({
      position: { x: 800, y: 5 },
      size,
      workArea,
      threshold: 40,
    });
    expect(result.anchor).toEqual({ horizontal: null, vertical: "top" });
    expect(result.position.y).toBe(0);
  });

  it("snaps to the bottom edge when within threshold", () => {
    const result = resolveSnap({
      position: { x: 800, y: 1040 - 34 - 20 },
      size,
      workArea,
      threshold: 40,
    });
    expect(result.anchor).toEqual({ horizontal: null, vertical: "bottom" });
    expect(result.position.y).toBe(1040 - 34);
  });

  it("anchors both axes in a corner", () => {
    const result = resolveSnap({
      position: { x: 12, y: 8 },
      size,
      workArea,
      threshold: 40,
    });
    expect(result.anchor).toEqual({ horizontal: "left", vertical: "top" });
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it("stays put when outside every attraction zone", () => {
    const result = resolveSnap({
      position: { x: 800, y: 500 },
      size,
      workArea,
      threshold: 40,
    });
    expect(result.anchor).toEqual({ horizontal: null, vertical: null });
    expect(result.position).toEqual({ x: 800, y: 500 });
  });
});

describe("applyAnchor", () => {
  it("grows toward the screen when anchored right and size increases", () => {
    const anchor: EdgeAnchor = { horizontal: "right", vertical: null };
    const position = applyAnchor({
      anchor,
      size: { width: 380, height: 520 },
      workArea,
      previousPosition: { x: 1920 - 168, y: 300 },
    });
    expect(position.x).toBe(1920 - 380);
    expect(position.y).toBe(300);
  });

  it("grows upward when anchored to the bottom", () => {
    const anchor: EdgeAnchor = { horizontal: null, vertical: "bottom" };
    const position = applyAnchor({
      anchor,
      size: { width: 380, height: 520 },
      workArea,
      previousPosition: { x: 700, y: 1040 - 34 },
    });
    expect(position.y).toBe(1040 - 520);
  });

  it("clamps when the anchored corner cannot fit on a smaller monitor", () => {
    const smallWorkArea: MonitorInfo = {
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
    };
    const anchor: EdgeAnchor = { horizontal: "right", vertical: "bottom" };
    const position = applyAnchor({
      anchor,
      size: { width: 380, height: 520 },
      workArea: smallWorkArea,
      previousPosition: { x: 232, y: -220 },
    });
    expect(position.x).toBe(20);
    expect(position.y).toBe(0);
  });

  it("leaves unanchored axis untouched (clamped)", () => {
    const anchor: EdgeAnchor = { horizontal: "left", vertical: null };
    const position = applyAnchor({
      anchor,
      size,
      workArea,
      previousPosition: { x: 500, y: 777 },
    });
    expect(position).toEqual({ x: 0, y: 777 });
  });
});

describe("isAnchored", () => {
  it("is false when both axes are null", () => {
    expect(isAnchored({ horizontal: null, vertical: null })).toBe(false);
  });

  it("is true when at least one axis is set", () => {
    expect(isAnchored({ horizontal: "left", vertical: null })).toBe(true);
    expect(isAnchored({ horizontal: null, vertical: "bottom" })).toBe(true);
  });
});

describe("serializeAnchor / parseAnchor", () => {
  it("round-trips a valid anchor", () => {
    const anchor: EdgeAnchor = { horizontal: "right", vertical: "top" };
    expect(parseAnchor(serializeAnchor(anchor))).toEqual(anchor);
  });

  it("returns null for missing, malformed or invalid stored values", () => {
    expect(parseAnchor(null)).toBeNull();
    expect(parseAnchor("not json")).toBeNull();
    expect(parseAnchor(JSON.stringify({ horizontal: "up", vertical: null }))).toBeNull();
    expect(parseAnchor(JSON.stringify({}))).toBeNull();
  });
});
