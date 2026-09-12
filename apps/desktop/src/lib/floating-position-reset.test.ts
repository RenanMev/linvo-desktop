import { currentMonitor } from "@tauri-apps/api/window";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetFloatingPosition,
  resolveResetPosition,
} from "@/lib/floating-position-reset";
import {
  COMPACT_SIZE,
  envelopePositionForPill,
  ISLAND_ENVELOPE_SIZE,
} from "@/lib/window-mode";
import { EDGE_MARGIN, loadIslandPillPosition, loadSavedAnchor } from "@/lib/window-storage";
import type { MonitorInfo } from "@/lib/window-position";
import {
  invokeMock,
  setPositionMock,
  setSizeMock,
  windowMock,
} from "@/test/mocks/tauri";

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

describe("resetFloatingPosition", () => {
  const monitorInfo = { x: 0, y: 0, width: 1920, height: 1080 };

  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    setPositionMock.mockClear();
    setSizeMock.mockClear();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "monitor_work_area") {
        return Promise.resolve(monitorInfo);
      }
      return Promise.resolve(undefined);
    });
    windowMock.scaleFactor.mockResolvedValue(1);
    windowMock.outerPosition.mockResolvedValue({ x: 900, y: 300 });
    windowMock.outerSize.mockResolvedValue(ISLAND_ENVELOPE_SIZE);
  });

  it("moves the envelope so the pill lands top-center, keeping the envelope's own size", async () => {
    const pillTarget = {
      x: Math.floor((1920 - COMPACT_SIZE.width) / 2),
      y: EDGE_MARGIN,
    };
    const envelopeTarget = envelopePositionForPill({
      pillPosition: pillTarget,
      growth: "down",
    });

    const growth = await resetFloatingPosition();

    expect(growth).toBe("down");
    expect(setPositionMock).toHaveBeenCalledWith(
      expect.objectContaining(envelopeTarget),
    );
    expect(setSizeMock).toHaveBeenCalledWith(
      expect.objectContaining(ISLAND_ENVELOPE_SIZE),
    );
  });

  it("returns null and moves nothing without a known monitor", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "monitor_work_area") {
        return Promise.reject(new Error("no such command"));
      }
      return Promise.resolve(undefined);
    });
    vi.mocked(currentMonitor).mockResolvedValueOnce(null);

    const growth = await resetFloatingPosition();

    expect(growth).toBeNull();
    expect(setPositionMock).not.toHaveBeenCalled();
  });

  it("persists the pill's top-center position, not the envelope's", async () => {
    await resetFloatingPosition();
    expect(loadIslandPillPosition()).toEqual({
      x: Math.floor((1920 - COMPACT_SIZE.width) / 2),
      y: EDGE_MARGIN,
    });
  });

  it("clears the saved anchor", async () => {
    await resetFloatingPosition();
    expect(loadSavedAnchor()).toEqual({ horizontal: null, vertical: null });
  });
});
