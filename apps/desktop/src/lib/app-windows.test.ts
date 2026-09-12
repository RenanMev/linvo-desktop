import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hideAllWindows,
  isAnyWindowVisible,
  showMainBar,
  toggleAppVisibility,
} from "@/lib/app-windows";
import { resetOverlayChromeCache } from "@/lib/overlay-chrome";
import {
  emitToMock,
  invokeMock,
  panelWindowMock,
  setFocusMock,
  showMock,
  unminimizeMock,
  windowMock,
} from "@/test/mocks/tauri";

describe("app-windows", () => {
  beforeEach(() => {
    resetOverlayChromeCache();
    invokeMock.mockReset();
    emitToMock.mockReset();
    showMock.mockClear();
    setFocusMock.mockClear();
    unminimizeMock.mockClear();
    windowMock.isVisible.mockResolvedValue(true);
    panelWindowMock.isVisible.mockResolvedValue(false);
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "panel_close" || cmd === "checklist_close") {
        return Promise.resolve(undefined);
      }
      if (cmd === "panel_is_open" || cmd === "checklist_is_open") {
        return Promise.resolve(false);
      }
      if (cmd === "show_window_no_activate") {
        // Como no runtime: `Ok(())` chega no front como `null`.
        return Promise.resolve(null);
      }
      return Promise.resolve(undefined);
    });
    emitToMock.mockResolvedValue(undefined);
  });

  it("showMainBar shows without focusing the compact window", async () => {
    await showMainBar();

    expect(invokeMock).toHaveBeenCalledWith("show_window_no_activate");
    expect(unminimizeMock).toHaveBeenCalled();
    expect(setFocusMock).not.toHaveBeenCalled();
    expect(showMock).not.toHaveBeenCalled();
  });

  it("showMainBar focuses only when the caller came from the keyboard", async () => {
    await showMainBar({ focus: true });

    expect(invokeMock).toHaveBeenCalledWith("show_window_no_activate");
    expect(setFocusMock).toHaveBeenCalled();
  });

  it("hideAllWindows hides main and closes panel when no checklist is active", async () => {
    const hideMock = vi.fn(() => Promise.resolve());
    windowMock.hide = hideMock;

    await hideAllWindows();

    expect(hideMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("panel_close");
    expect(emitToMock).not.toHaveBeenCalled();
  });

  it("isAnyWindowVisible returns true when main is visible", async () => {
    windowMock.isVisible.mockResolvedValue(true);
    invokeMock.mockResolvedValue(false);

    await expect(isAnyWindowVisible()).resolves.toBe(true);
  });

  it("isAnyWindowVisible returns true when panel is visible", async () => {
    windowMock.isVisible.mockResolvedValue(false);
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "panel_is_open") {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    });

    await expect(isAnyWindowVisible()).resolves.toBe(true);
  });

  it("toggleAppVisibility hides all when any window is visible", async () => {
    windowMock.isVisible.mockResolvedValue(true);
    const hideMock = vi.fn(() => Promise.resolve());
    windowMock.hide = hideMock;

    await toggleAppVisibility();

    expect(hideMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("panel_close");
  });

  it("toggleAppVisibility shows main when all hidden", async () => {
    windowMock.isVisible.mockResolvedValue(false);
    invokeMock.mockResolvedValue(false);

    await toggleAppVisibility();

    expect(invokeMock).toHaveBeenCalledWith("show_window_no_activate");
    expect(setFocusMock).not.toHaveBeenCalled();
  });
});
