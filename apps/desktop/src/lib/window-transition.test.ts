import { describe, expect, it } from "vitest";

import {
  resolveCollapsePosition,
  resolveExpandPlan,
} from "@/lib/window-transition";
import type { MonitorInfo } from "@/lib/window-position";

const monitor: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

describe("window-transition positions", () => {
  it("moves to visible compact spot first when bar is off-screen", () => {
    const plan = resolveExpandPlan({
      currentPosition: { x: -400, y: -200 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 288, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toEqual({ x: 0, y: 0 });
    expect(plan.finalPosition).toEqual({ x: 0, y: 0 });
  });

  it("expands from the center when the target fits around the current bar", () => {
    const plan = resolveExpandPlan({
      currentPosition: { x: 400, y: 300 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 288, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toBeNull();
    expect(plan.finalPosition).toEqual({
      x: 400 + Math.round((140 - 288) / 2),
      y: 300 + Math.round((40 - 420) / 2),
    });
  });

  it("clamps final bounds to the monitor", () => {
    const plan = resolveExpandPlan({
      currentPosition: { x: 1800, y: 900 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 288, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toEqual({
      x: 1920 - 140,
      y: 900,
    });
    expect(plan.finalPosition).toEqual({
      x: 1920 - 288,
      y: 1080 - 420,
    });
  });

  it("keeps collapse position when compact still fits", () => {
    expect(
      resolveCollapsePosition({
        currentPosition: { x: 120, y: 40 },
        targetSize: { width: 140, height: 40 },
        monitor,
      }),
    ).toEqual({ x: 120, y: 40 });
  });

  it("collapses toward the center when current size is known and compact fits", () => {
    expect(
      resolveCollapsePosition({
        currentPosition: { x: 400, y: 220 },
        currentSize: { width: 380, height: 520 },
        targetSize: { width: 168, height: 34 },
        monitor,
      }),
    ).toEqual({
      x: 400 + Math.round((380 - 168) / 2),
      y: 220 + Math.round((520 - 34) / 2),
    });
  });

  it("recomputes top-center collapse position when compact no longer fits", () => {
    expect(
      resolveCollapsePosition({
        currentPosition: { x: 1900, y: 1060 },
        targetSize: { width: 140, height: 40 },
        monitor,
      }),
    ).toEqual({
      x: Math.max(0, Math.floor((1920 - 140) / 2)),
      y: 24,
    });
  });

  it("keeps current position when no monitor is detected", () => {
    expect(
      resolveExpandPlan({
        currentPosition: { x: 10, y: 20 },
        currentSize: { width: 140, height: 40 },
        targetSize: { width: 288, height: 420 },
        monitor: null,
      }),
    ).toEqual({ moveFirst: null, finalPosition: { x: 10, y: 20 } });

    expect(
      resolveCollapsePosition({
        currentPosition: { x: 10, y: 20 },
        targetSize: { width: 140, height: 40 },
        monitor: null,
      }),
    ).toEqual({ x: 10, y: 20 });
  });

  it("grows toward the screen when expanding from a right-anchored position", () => {
    const plan = resolveExpandPlan({
      currentPosition: { x: 1920 - 168, y: 300 },
      currentSize: { width: 168, height: 34 },
      targetSize: { width: 380, height: 520 },
      monitor,
      anchor: { horizontal: "right", vertical: null },
    });

    expect(plan.moveFirst).toBeNull();
    expect(plan.finalPosition.x).toBe(1920 - 380);
  });

  it("collapses back flush against the anchored edge, not the stale position", () => {
    const position = resolveCollapsePosition({
      currentPosition: { x: 1920 - 380, y: 300 },
      targetSize: { width: 168, height: 34 },
      monitor,
      anchor: { horizontal: "right", vertical: null },
    });

    expect(position.x).toBe(1920 - 168);
  });

  it("centers horizontally under a top-docked bar instead of opening to one side", () => {
    const barPosition = { x: 876, y: 0 };
    const barSize = { width: 168, height: 34 };
    const panelSize = { width: 380, height: 520 };
    const anchor = { horizontal: null, vertical: "top" } as const;

    const plan = resolveExpandPlan({
      currentPosition: barPosition,
      currentSize: barSize,
      targetSize: panelSize,
      monitor,
      anchor,
    });

    // Cresce para baixo colado no topo, mas centralizado no eixo livre.
    expect(plan.finalPosition).toEqual({
      x: 876 + Math.round((168 - 380) / 2),
      y: 0,
    });
  });

  it("collapses a top-docked panel back to the exact bar position", () => {
    const barPosition = { x: 876, y: 0 };
    const barSize = { width: 168, height: 34 };
    const panelSize = { width: 380, height: 520 };
    const anchor = { horizontal: null, vertical: "top" } as const;

    const expanded = resolveExpandPlan({
      currentPosition: barPosition,
      currentSize: barSize,
      targetSize: panelSize,
      monitor,
      anchor,
    });

    const collapsed = resolveCollapsePosition({
      currentPosition: expanded.finalPosition,
      currentSize: panelSize,
      targetSize: barSize,
      monitor,
      anchor,
    });

    expect(collapsed).toEqual(barPosition);
  });

  it("round-trips expand and collapse without drifting when unanchored", () => {
    const barPosition = { x: 400, y: 300 };
    const barSize = { width: 168, height: 34 };
    const panelSize = { width: 380, height: 520 };

    const expanded = resolveExpandPlan({
      currentPosition: barPosition,
      currentSize: barSize,
      targetSize: panelSize,
      monitor,
    });

    expect(
      resolveCollapsePosition({
        currentPosition: expanded.finalPosition,
        currentSize: panelSize,
        targetSize: barSize,
        monitor,
      }),
    ).toEqual(barPosition);
  });

  it("ignores anchor when it is empty on both axes and grows from center", () => {
    const plan = resolveExpandPlan({
      currentPosition: { x: 400, y: 300 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 288, height: 420 },
      monitor,
      anchor: { horizontal: null, vertical: null },
    });

    expect(plan.finalPosition).toEqual({
      x: 400 + Math.round((140 - 288) / 2),
      y: 300 + Math.round((40 - 420) / 2),
    });
  });
});
