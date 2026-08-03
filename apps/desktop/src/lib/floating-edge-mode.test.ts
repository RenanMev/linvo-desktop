import { describe, expect, it } from "vitest";

import {
  edgeHandleSize,
  resolveEdgeHandleBounds,
  resolveNearestAnchor,
} from "@/lib/floating-edge-mode";
import {
  EDGE_HANDLE_LENGTH,
  EDGE_HANDLE_THICKNESS,
} from "@/lib/window-mode";
import type { MonitorInfo } from "@/lib/window-position";

const workArea: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1040 },
};

// Derivado das constantes de propósito: a espessura/comprimento são valores de
// ajuste, e fixá-los aqui só faria o teste quebrar a cada tuning.
const stripeAcross = { width: EDGE_HANDLE_THICKNESS, height: EDGE_HANDLE_LENGTH };
const stripeAlong = { width: EDGE_HANDLE_LENGTH, height: EDGE_HANDLE_THICKNESS };

describe("edgeHandleSize", () => {
  it("is a vertical stripe when anchored to a side", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: null })).toEqual(
      stripeAcross,
    );
    expect(edgeHandleSize({ horizontal: "right", vertical: null })).toEqual(
      stripeAcross,
    );
  });

  it("is a horizontal stripe when anchored to top or bottom", () => {
    expect(edgeHandleSize({ horizontal: null, vertical: "top" })).toEqual(
      stripeAlong,
    );
    expect(edgeHandleSize({ horizontal: null, vertical: "bottom" })).toEqual(
      stripeAlong,
    );
  });

  it("falls back to a vertical stripe for a corner or no anchor", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: "top" })).toEqual(
      stripeAcross,
    );
    expect(edgeHandleSize({ horizontal: null, vertical: null })).toEqual(
      stripeAcross,
    );
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
