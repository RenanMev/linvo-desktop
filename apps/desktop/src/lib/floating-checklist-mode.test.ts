import { describe, expect, it } from "vitest";

import {
  resolveChecklistCollapsePosition,
  resolveChecklistExpandPosition,
} from "@/lib/floating-checklist-mode";
import type { MonitorInfo } from "@/lib/window-position";

const monitor: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

describe("floating-checklist-mode positions", () => {
  it("moves to visible compact spot first when bar is off-screen", () => {
    const plan = resolveChecklistExpandPosition({
      currentPosition: { x: -400, y: -200 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 288, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toEqual({ x: 0, y: 0 });
    expect(plan.finalPosition).toEqual({ x: 0, y: 0 });
  });

  it("resizes without a pre-move when the bar is already visible, centering on the bar", () => {
    const plan = resolveChecklistExpandPosition({
      currentPosition: { x: 100, y: 80 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 288, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toBeNull();
    // Centro da barra (100 + 140/2 = 170) vira o centro do checklist; só o
    // eixo vertical, que não caberia acima do topo, é grudado na borda.
    expect(plan.finalPosition).toEqual({ x: 26, y: 0 });
  });

  it("clamps final checklist bounds to the monitor", () => {
    const plan = resolveChecklistExpandPosition({
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
      resolveChecklistCollapsePosition({
        currentPosition: { x: 120, y: 40 },
        targetSize: { width: 140, height: 40 },
        monitor,
      }),
    ).toEqual({ x: 120, y: 40 });
  });
});
