import { beforeEach, describe, expect, it } from "vitest";
import { getCurrentWindow } from "@tauri-apps/api/window";

import {
  applyWindowBoundsWithFallback,
  computeCenteredPosition,
  logicalToPhysical,
} from "@/lib/window-animation";
import { invokeMock, setPositionMock, setSizeMock } from "@/test/mocks/tauri";

describe("logicalToPhysical", () => {
  it("scales logical size by factor", () => {
    expect(logicalToPhysical({ width: 100, height: 50 }, 1.5)).toEqual({
      width: 150,
      height: 75,
    });
  });

  it("keeps size unchanged at scale 1", () => {
    expect(logicalToPhysical({ width: 140, height: 40 }, 1)).toEqual({
      width: 140,
      height: 40,
    });
  });
});

describe("computeCenteredPosition", () => {
  it("centers window on monitor", () => {
    const monitor = {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
    };
    const winSize = { width: 900, height: 600 };

    expect(computeCenteredPosition(monitor, winSize)).toEqual({
      x: 510,
      y: 240,
    });
  });

  it("respects monitor offset on multi-monitor setups", () => {
    const monitor = {
      position: { x: 1920, y: 0 },
      size: { width: 1920, height: 1080 },
    };
    const winSize = { width: 900, height: 600 };

    expect(computeCenteredPosition(monitor, winSize)).toEqual({
      x: 2430,
      y: 240,
    });
  });
});

describe("applyWindowBoundsWithFallback", () => {
  const bounds = {
    position: { x: 24, y: 1016 },
    size: { width: 140, height: 40 },
  };

  beforeEach(() => {
    invokeMock.mockReset();
    setPositionMock.mockClear();
    setSizeMock.mockClear();
  });

  it("skips fallback when animation completes", async () => {
    invokeMock.mockResolvedValue(true);

    await applyWindowBoundsWithFallback(getCurrentWindow(), bounds);

    expect(invokeMock).toHaveBeenCalledWith("animate_window_bounds", {
      to: { x: 24, y: 1016, width: 140, height: 40 },
      durationMs: 200,
    });
    expect(setSizeMock).not.toHaveBeenCalled();
    expect(setPositionMock).not.toHaveBeenCalled();
  });

  it("falls back when animation returns false", async () => {
    invokeMock.mockResolvedValue(false);

    await applyWindowBoundsWithFallback(getCurrentWindow(), bounds);

    expect(setSizeMock).toHaveBeenCalled();
    expect(setPositionMock).toHaveBeenCalled();
  });

  it("falls back when animation throws", async () => {
    invokeMock.mockRejectedValue(new Error("SetWindowPos failed"));

    await applyWindowBoundsWithFallback(getCurrentWindow(), bounds);

    expect(setSizeMock).toHaveBeenCalled();
    expect(setPositionMock).toHaveBeenCalled();
  });
});
