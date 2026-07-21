import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hideAllWindows,
  isAnyWindowVisible,
  showMainBar,
  toggleAppVisibility,
} from "@/lib/app-windows";
import { invokeMock, panelWindowMock, showMock, windowMock } from "@/test/mocks/tauri";

describe("app-windows", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    showMock.mockClear();
    windowMock.isVisible.mockResolvedValue(true);
    panelWindowMock.isVisible.mockResolvedValue(false);
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "panel_close" || cmd === "checklist_close") {
        return Promise.resolve(undefined);
      }
      if (cmd === "panel_is_open" || cmd === "checklist_is_open") {
        return Promise.resolve(false);
      }
      return Promise.resolve(undefined);
    });
  });

  it("showMainBar shows and focuses main window", async () => {
    await showMainBar();

    expect(showMock).toHaveBeenCalled();
  });

  it("hideAllWindows hides main and closes panel and checklist", async () => {
    const hideMock = vi.fn(() => Promise.resolve());
    windowMock.hide = hideMock;

    await hideAllWindows();

    expect(hideMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("panel_close");
    expect(invokeMock).toHaveBeenCalledWith("checklist_close");
  });

  it("isAnyWindowVisible returns true when main is visible", async () => {
    windowMock.isVisible.mockResolvedValue(true);
    invokeMock.mockResolvedValue(false);

    await expect(isAnyWindowVisible()).resolves.toBe(true);
  });

  it("isAnyWindowVisible returns true when checklist is visible", async () => {
    windowMock.isVisible.mockResolvedValue(false);
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "checklist_is_open") {
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
    expect(invokeMock).toHaveBeenCalledWith("checklist_close");
  });

  it("toggleAppVisibility shows main when all hidden", async () => {
    windowMock.isVisible.mockResolvedValue(false);
    invokeMock.mockResolvedValue(false);

    await toggleAppVisibility();

    expect(showMock).toHaveBeenCalled();
  });
});
