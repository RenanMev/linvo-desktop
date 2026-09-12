import { beforeEach, describe, expect, it } from "vitest";

import {
  overlayChromeStatus,
  rectsToHoles,
  resetOverlayChromeCache,
  setClickThrough,
  setExcludeFromCapture,
  setTopmostGuard,
  showWindowNoActivate,
} from "@/lib/overlay-chrome";
import { invokeMock, setFocusMock, showMock, windowMock } from "@/test/mocks/tauri";

const okStatus = {
  noActivateOk: true,
  clickThrough: true,
  excludeFromCapture: false,
  topmostGuard: true,
  win32Ok: true,
};

describe("overlay-chrome", () => {
  beforeEach(() => {
    resetOverlayChromeCache();
    invokeMock.mockReset();
    showMock.mockClear();
    setFocusMock.mockClear();
    windowMock.isVisible.mockResolvedValue(true);
  });

  it("wrappers call the locked invoke names", async () => {
    invokeMock.mockResolvedValue(okStatus);

    await showWindowNoActivate();
    await setClickThrough({
      enabled: true,
      holes: [{ x: 1, y: 2, width: 3, height: 4 }],
    });
    await setExcludeFromCapture(true);
    await setTopmostGuard(true);
    await overlayChromeStatus();

    expect(invokeMock).toHaveBeenCalledWith("show_window_no_activate");
    expect(invokeMock).toHaveBeenCalledWith("set_click_through", {
      enabled: true,
      holes: [{ x: 1, y: 2, width: 3, height: 4 }],
    });
    expect(invokeMock).toHaveBeenCalledWith("set_exclude_from_capture", {
      enabled: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("set_topmost_guard", {
      enabled: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("overlay_chrome_status");
    expect(setFocusMock).not.toHaveBeenCalled();
  });

  it("does not fall back to show() when the native command succeeds", async () => {
    // `Result<(), String>` resolve como `null` no sucesso: tratar isso como
    // falha fazia o `show()` rodar sempre e devolver o roubo de foco do KAN-10.
    invokeMock.mockResolvedValue(null);

    await showWindowNoActivate();

    expect(invokeMock).toHaveBeenCalledWith("show_window_no_activate");
    expect(showMock).not.toHaveBeenCalled();
    expect(setFocusMock).not.toHaveBeenCalled();
  });

  it("retries click-through after a failed invoke", async () => {
    const payload = {
      enabled: true,
      holes: [{ x: 1, y: 2, width: 3, height: 4 }],
    };
    invokeMock.mockRejectedValueOnce(new Error("busy"));

    await setClickThrough(payload);
    invokeMock.mockResolvedValue(okStatus);
    await setClickThrough(payload);

    expect(
      invokeMock.mock.calls.filter((call) => call[0] === "set_click_through"),
    ).toHaveLength(2);
  });

  it("skips duplicate click-through payloads", async () => {
    invokeMock.mockResolvedValue(okStatus);
    const payload = {
      enabled: true,
      holes: [{ x: 1, y: 2, width: 3, height: 4 }],
    };

    await setClickThrough(payload);
    await setClickThrough(payload);

    expect(
      invokeMock.mock.calls.filter((call) => call[0] === "set_click_through"),
    ).toHaveLength(1);
  });

  it("falls back to show without setFocus when no-activate is unavailable", async () => {
    invokeMock.mockResolvedValue({
      ...okStatus,
      noActivateOk: false,
      win32Ok: false,
    });
    await overlayChromeStatus();
    invokeMock.mockClear();

    await showWindowNoActivate();

    expect(invokeMock).not.toHaveBeenCalledWith("show_window_no_activate");
    expect(showMock).toHaveBeenCalled();
    expect(setFocusMock).not.toHaveBeenCalled();
  });

  it("falls back to show without throwing when invoke fails", async () => {
    invokeMock.mockRejectedValue(new Error("command missing"));

    await expect(showWindowNoActivate()).resolves.toBeUndefined();
    expect(showMock).toHaveBeenCalled();
    expect(setFocusMock).not.toHaveBeenCalled();
  });

  it("maps client rects to physical holes", () => {
    expect(
      rectsToHoles(
        [{ left: 10.2, top: 4.8, width: 20.4, height: 8.2 }],
        1.5,
        { x: 2, y: 1 },
      ),
    ).toEqual([{ x: 18, y: 9, width: 31, height: 12 }]);
  });

  it("drops empty rects", () => {
    expect(
      rectsToHoles([{ left: 0, top: 0, width: 0, height: 10 }], 1),
    ).toEqual([]);
  });
});
