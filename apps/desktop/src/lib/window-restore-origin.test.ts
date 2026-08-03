import { beforeEach, describe, expect, it } from "vitest";

import {
  clearRestoreOrigin,
  loadRestoreOrigin,
  rememberRestoreOrigin,
  resolveRestorePosition,
} from "@/lib/window-restore-origin";
import { resolveCollapsePosition, resolveExpandPlan } from "@/lib/window-transition";
import { logicalToPhysical } from "@/lib/window-animation";
import { COMPACT_SIZE, QUICK_MENU_SIZE } from "@/lib/window-mode";
import type { MonitorInfo } from "@/lib/window-position";

const origin = {
  compactPosition: { x: 600, y: 300 },
  expandedPosition: { x: 468, y: 57 },
  expandedSize: { width: 475, height: 650 },
};

describe("restore origin store", () => {
  beforeEach(() => {
    clearRestoreOrigin("quick-menu");
    clearRestoreOrigin("checklist");
  });

  it("round-trips a remembered origin", () => {
    rememberRestoreOrigin("quick-menu", origin);
    expect(loadRestoreOrigin("quick-menu")).toEqual(origin);
  });

  it("keeps keys independent", () => {
    rememberRestoreOrigin("quick-menu", origin);
    expect(loadRestoreOrigin("checklist")).toBeNull();
  });

  it("clears a remembered origin", () => {
    rememberRestoreOrigin("quick-menu", origin);
    clearRestoreOrigin("quick-menu");
    expect(loadRestoreOrigin("quick-menu")).toBeNull();
  });
});

describe("resolveRestorePosition", () => {
  it("restores the compact position when the panel was not touched", () => {
    expect(
      resolveRestorePosition({
        origin,
        currentPosition: origin.expandedPosition,
        currentSize: origin.expandedSize,
      }),
    ).toEqual(origin.compactPosition);
  });

  it("gives up when the panel was dragged", () => {
    expect(
      resolveRestorePosition({
        origin,
        currentPosition: { x: 900, y: 120 },
        currentSize: origin.expandedSize,
      }),
    ).toBeNull();
  });

  it("gives up when the panel was resized", () => {
    expect(
      resolveRestorePosition({
        origin,
        currentPosition: origin.expandedPosition,
        currentSize: { width: 600, height: 700 },
      }),
    ).toBeNull();
  });

  it("gives up when there is no remembered origin", () => {
    expect(
      resolveRestorePosition({
        origin: null,
        currentPosition: origin.expandedPosition,
        currentSize: origin.expandedSize,
      }),
    ).toBeNull();
  });
});

/**
 * O drift só aparece quando a diferença de tamanho é ímpar, o que acontece nas
 * escalas de DPI fracionárias do Windows — em 1.0 os tamanhos são pares e a
 * conta por centro já fecha exata.
 */
describe("open/close round trip does not drift", () => {
  const monitor: MonitorInfo = {
    position: { x: 0, y: 0 },
    size: { width: 2560, height: 1440 },
  };

  for (const scale of [1, 1.25, 1.5, 1.75]) {
    it(`keeps the bar in place across 3 cycles at scale ${scale}`, () => {
      const compactSize = logicalToPhysical(COMPACT_SIZE, scale);
      const panelSize = logicalToPhysical(QUICK_MENU_SIZE, scale);
      const start = { x: 600, y: 300 };
      let position = start;

      for (let cycle = 0; cycle < 3; cycle += 1) {
        const plan = resolveExpandPlan({
          currentPosition: position,
          currentSize: compactSize,
          targetSize: panelSize,
          monitor,
        });

        rememberRestoreOrigin("quick-menu", {
          compactPosition: plan.moveFirst ?? position,
          expandedPosition: plan.finalPosition,
          expandedSize: panelSize,
        });

        const restored = resolveRestorePosition({
          origin: loadRestoreOrigin("quick-menu"),
          currentPosition: plan.finalPosition,
          currentSize: panelSize,
        });
        clearRestoreOrigin("quick-menu");

        position =
          restored ??
          resolveCollapsePosition({
            currentPosition: plan.finalPosition,
            currentSize: panelSize,
            targetSize: compactSize,
            monitor,
          });
      }

      expect(position).toEqual(start);
    });
  }
});
