import { describe, expect, it } from "vitest";

import {
  clampToMonitor,
  computeBottomLeft,
  computeTopCenter,
  parsePosition,
  serializePosition,
  type MonitorInfo,
} from "@/lib/window-position";

const primaryMonitor: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

const secondaryMonitor: MonitorInfo = {
  position: { x: 1920, y: 0 },
  size: { width: 2560, height: 1440 },
};

describe("computeBottomLeft", () => {
  it("places the window at the bottom-left with the given margin", () => {
    const pos = computeBottomLeft(primaryMonitor, { width: 140, height: 40 }, 24);
    expect(pos).toEqual({ x: 24, y: 1080 - 40 - 24 });
  });

  it("offsets by the monitor origin on a secondary monitor", () => {
    const pos = computeBottomLeft(secondaryMonitor, { width: 140, height: 40 }, 24);
    expect(pos).toEqual({ x: 1920 + 24, y: 1440 - 40 - 24 });
  });
});

describe("computeTopCenter", () => {
  it("places the window at the top center with the given margin", () => {
    const pos = computeTopCenter(primaryMonitor, { width: 140, height: 40 }, 24);
    expect(pos).toEqual({ x: Math.floor((1920 - 140) / 2), y: 24 });
  });

  it("offsets by the monitor origin on a secondary monitor", () => {
    const pos = computeTopCenter(secondaryMonitor, { width: 140, height: 40 }, 24);
    expect(pos).toEqual({
      x: 1920 + Math.floor((2560 - 140) / 2),
      y: 24,
    });
  });
});

describe("clampToMonitor", () => {
  const winSize = { width: 140, height: 40 };

  it("keeps an in-bounds position unchanged", () => {
    const pos = { x: 100, y: 100 };
    expect(clampToMonitor(pos, winSize, primaryMonitor)).toEqual(pos);
  });

  it("clamps a position past the right/bottom edges into view", () => {
    const pos = { x: 5000, y: 5000 };
    expect(clampToMonitor(pos, winSize, primaryMonitor)).toEqual({
      x: 1920 - 140,
      y: 1080 - 40,
    });
  });

  it("clamps a negative position back to the monitor origin", () => {
    const pos = { x: -300, y: -300 };
    expect(clampToMonitor(pos, winSize, primaryMonitor)).toEqual({ x: 0, y: 0 });
  });
});

describe("serialize/parse position", () => {
  it("round-trips a position", () => {
    const pos = { x: 42, y: 84 };
    expect(parsePosition(serializePosition(pos))).toEqual(pos);
  });

  it("returns null for null input", () => {
    expect(parsePosition(null)).toBeNull();
  });

  it("returns null for invalid json", () => {
    expect(parsePosition("not-json")).toBeNull();
  });

  it("returns null when fields are missing or non-numeric", () => {
    expect(parsePosition('{"x":1}')).toBeNull();
    expect(parsePosition('{"x":"1","y":2}')).toBeNull();
  });
});
