import { describe, expect, it } from "vitest";

import {
  edgeHandleSize,
  resolveEdgeHandleBounds,
  resolveNearestAnchor,
} from "@/lib/floating-edge-mode";
import type { MonitorInfo } from "@/lib/window-position";

const workArea: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1040 },
};

describe("edgeHandleSize", () => {
  it("is a vertical stripe when anchored to a side", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: null })).toEqual({
      width: 12,
      height: 64,
    });
    expect(edgeHandleSize({ horizontal: "right", vertical: null })).toEqual({
      width: 12,
      height: 64,
    });
  });

  it("is a horizontal stripe when anchored to top or bottom", () => {
    expect(edgeHandleSize({ horizontal: null, vertical: "top" })).toEqual({
      width: 64,
      height: 12,
    });
    expect(edgeHandleSize({ horizontal: null, vertical: "bottom" })).toEqual({
      width: 64,
      height: 12,
    });
  });

  it("falls back to a vertical stripe for a corner or no anchor", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: "top" })).toEqual({
      width: 12,
      height: 64,
    });
    expect(edgeHandleSize({ horizontal: null, vertical: null })).toEqual({
      width: 12,
      height: 64,
    });
  });

  it("never exceeds 16px on the perpendicular axis", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: null }).width).toBeLessThanOrEqual(16);
    expect(edgeHandleSize({ horizontal: null, vertical: "top" }).height).toBeLessThanOrEqual(16);
  });
});

describe("resolveEdgeHandleBounds", () => {
  it("hugs the left edge, keeping the vertical coordinate", () => {
    const position = resolveEdgeHandleBounds({
      anchor: { horizontal: "left", vertical: null },
      size: { width: 12, height: 64 },
      workArea,
      previousPosition: { x: 500, y: 300 },
    });
    expect(position).toEqual({ x: 0, y: 300 });
  });

  it("hugs the bottom edge, keeping the horizontal coordinate", () => {
    const position = resolveEdgeHandleBounds({
      anchor: { horizontal: null, vertical: "bottom" },
      size: { width: 64, height: 12 },
      workArea,
      previousPosition: { x: 700, y: 300 },
    });
    expect(position).toEqual({ x: 700, y: 1040 - 12 });
  });
});

describe("resolveNearestAnchor", () => {
  it("anchors to exactly the closest edge regardless of distance", () => {
    const anchor = resolveNearestAnchor({
      position: { x: 900, y: 500 },
      size: { width: 168, height: 34 },
      workArea,
    });
    expect(anchor).toEqual({ horizontal: null, vertical: "top" });
  });

  it("picks the closest axis instead of forcing a corner", () => {
    const anchor = resolveNearestAnchor({
      position: { x: 100, y: 60 },
      size: { width: 168, height: 34 },
      workArea,
    });
    expect(anchor).toEqual({ horizontal: null, vertical: "top" });
  });
});
