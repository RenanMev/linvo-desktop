import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureCompactWindowBounds,
  isCompactWindowSize,
} from "@/lib/floating-compact-bounds";
import { COMPACT_SIZE, QUICK_MENU_SIZE } from "@/lib/window-mode";
import { loadSavedPosition } from "@/lib/window-storage";
import {
  invokeMock,
  setMinSizeMock,
  setResizableMock,
  windowMock,
} from "@/test/mocks/tauri";

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1080 };

function mockBounds(bounds: {
  position: { x: number; y: number };
  size: { width: number; height: number };
}) {
  windowMock.outerPosition.mockResolvedValue(bounds.position);
  windowMock.outerSize.mockResolvedValue(bounds.size);
}

function boundsCalls() {
  return invokeMock.mock.calls.filter((call) => call[0] === "set_window_bounds");
}

describe("isCompactWindowSize", () => {
  it("accepts a 1px drift from the ceil applied on fractional scales", () => {
    expect(isCompactWindowSize({ width: 211, height: 43 }, { width: 210, height: 43 })).toBe(true);
  });

  it("rejects an expanded window", () => {
    expect(isCompactWindowSize(QUICK_MENU_SIZE, COMPACT_SIZE)).toBe(false);
  });
});

describe("ensureCompactWindowBounds", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    setMinSizeMock.mockClear();
    setResizableMock.mockClear();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "monitor_work_area") {
        return Promise.resolve(WORK_AREA);
      }
      return Promise.resolve(undefined);
    });
    windowMock.scaleFactor.mockResolvedValue(1);
    mockBounds({
      position: { x: 0, y: 0 },
      size: { ...COMPACT_SIZE },
    });
  });

  it("leaves an already compact window alone", async () => {
    await expect(ensureCompactWindowBounds()).resolves.toBe(false);
    expect(boundsCalls()).toHaveLength(0);
  });

  it("shrinks a window left expanded, centering the pill on the panel", async () => {
    mockBounds({
      position: { x: 400, y: 200 },
      size: { ...QUICK_MENU_SIZE },
    });

    await expect(ensureCompactWindowBounds()).resolves.toBe(true);

    expect(boundsCalls()).toEqual([
      [
        "set_window_bounds",
        {
          to: {
            x: 400 + Math.round((QUICK_MENU_SIZE.width - COMPACT_SIZE.width) / 2),
            y: 200 + Math.round((QUICK_MENU_SIZE.height - COMPACT_SIZE.height) / 2),
            width: COMPACT_SIZE.width,
            height: COMPACT_SIZE.height,
          },
        },
      ],
    ]);
  });

  it("clears the quick-menu minimum before resizing", async () => {
    mockBounds({
      position: { x: 400, y: 200 },
      size: { ...QUICK_MENU_SIZE },
    });

    await ensureCompactWindowBounds();

    // Sem isto o Windows trava o SetWindowPos no mínimo do quick menu.
    expect(setMinSizeMock).toHaveBeenCalledWith(null);
    expect(setResizableMock).toHaveBeenCalledWith(false);
  });

  /*
   * Regressão: `setMinSize` exige `core:window:allow-set-min-size` na
   * capability. Sem ela a chamada rejeita, e deixar a rejeição propagar abortava
   * o encolhimento — a janela ficava do tamanho do quick menu.
   */
  it("still shrinks when clearing the minimum size is denied", async () => {
    mockBounds({
      position: { x: 400, y: 200 },
      size: { ...QUICK_MENU_SIZE },
    });
    setMinSizeMock.mockRejectedValueOnce(
      new Error("window.set_min_size not allowed"),
    );

    await expect(ensureCompactWindowBounds()).resolves.toBe(true);
    expect(boundsCalls()).toHaveLength(1);
  });

  it("skips the resize when the caller no longer wants compact bounds", async () => {
    mockBounds({
      position: { x: 400, y: 200 },
      size: { ...QUICK_MENU_SIZE },
    });

    await expect(
      ensureCompactWindowBounds({ shouldApply: () => false }),
    ).resolves.toBe(false);
    expect(boundsCalls()).toHaveLength(0);
    expect(setMinSizeMock).not.toHaveBeenCalled();
  });

  it("persists the reconciled position for the next launch", async () => {
    mockBounds({
      position: { x: 400, y: 200 },
      size: { ...QUICK_MENU_SIZE },
    });

    await ensureCompactWindowBounds();

    expect(loadSavedPosition()).toEqual({
      x: 400 + Math.round((QUICK_MENU_SIZE.width - COMPACT_SIZE.width) / 2),
      y: 200 + Math.round((QUICK_MENU_SIZE.height - COMPACT_SIZE.height) / 2),
    });
  });
});
