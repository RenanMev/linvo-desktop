import { describe, expect, it } from "vitest";

import {
  resolveQuickMenuCollapsePosition,
  resolveQuickMenuExpandPosition,
  resolveQuickMenuSize,
} from "@/lib/floating-quick-menu-mode";
import type { MonitorInfo } from "@/lib/window-position";

const monitor: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

describe("floating-quick-menu-mode positions", () => {
  it("shrinks the quick menu to the usable area on a small monitor", () => {
    expect(
      resolveQuickMenuSize({
        targetSize: { width: 380, height: 520 },
        monitor: {
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
        },
        margin: 24,
      }),
    ).toEqual({ width: 352, height: 252 });
  });

  it("moves to visible compact spot first when bar is off-screen", () => {
    const plan = resolveQuickMenuExpandPosition({
      currentPosition: { x: -400, y: -200 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 320, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toEqual({ x: 0, y: 0 });
    expect(plan.finalPosition).toEqual({ x: 0, y: 0 });
  });

  it("resizes without a pre-move when the bar is already visible, centering on the bar", () => {
    const plan = resolveQuickMenuExpandPosition({
      currentPosition: { x: 100, y: 80 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 320, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toBeNull();
    // Centro da barra (100 + 140/2 = 170) vira o centro do painel; o eixo
    // vertical não caberia acima do topo, então só ele é grudado na borda.
    expect(plan.finalPosition).toEqual({ x: 10, y: 0 });
  });

  it("clamps final quick-menu bounds to the monitor", () => {
    const plan = resolveQuickMenuExpandPosition({
      currentPosition: { x: 1800, y: 900 },
      currentSize: { width: 140, height: 40 },
      targetSize: { width: 320, height: 420 },
      monitor,
    });

    expect(plan.moveFirst).toEqual({
      x: 1920 - 140,
      y: 900,
    });
    expect(plan.finalPosition).toEqual({
      x: 1920 - 320,
      y: 1080 - 420,
    });
  });

  it("keeps collapse position when compact still fits", () => {
    expect(
      resolveQuickMenuCollapsePosition({
        currentPosition: { x: 120, y: 40 },
        targetSize: { width: 140, height: 40 },
        monitor,
      }),
    ).toEqual({ x: 120, y: 40 });
  });
});
