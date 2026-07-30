import { describe, expect, it } from "vitest";

import { resolveResetPosition } from "@/lib/floating-position-reset";
import { COMPACT_SIZE } from "@/lib/window-mode";
import { EDGE_MARGIN } from "@/lib/window-storage";
import type { MonitorInfo } from "@/lib/window-position";

const monitor: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

describe("resolveResetPosition", () => {
  it("returns the top-center resting spot", () => {
    expect(resolveResetPosition({ monitor, size: COMPACT_SIZE })).toEqual({
      x: Math.floor((1920 - COMPACT_SIZE.width) / 2),
      y: EDGE_MARGIN,
    });
  });

  it("respects the monitor offset on multi-monitor setups", () => {
    expect(
      resolveResetPosition({
        monitor: {
          position: { x: 1920, y: 0 },
          size: { width: 1920, height: 1080 },
        },
        size: COMPACT_SIZE,
      }),
    ).toEqual({
      x: 1920 + Math.floor((1920 - COMPACT_SIZE.width) / 2),
      y: EDGE_MARGIN,
    });
  });

  it("returns null when no monitor is detected", () => {
    expect(
      resolveResetPosition({ monitor: null, size: COMPACT_SIZE }),
    ).toBeNull();
  });
});
