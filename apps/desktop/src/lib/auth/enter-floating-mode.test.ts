import { beforeEach, describe, expect, it, vi } from "vitest";

import { enterFloatingMode } from "@/lib/auth/enter-floating-mode";
import { updateTaskbarVisibility } from "@/lib/app-windows";
import { resetDesktopSettingsCache } from "@/lib/desktop-settings-store";
import { resetOverlayChromeCache } from "@/lib/overlay-chrome";
import { resetWindowStorageCache } from "@/lib/window-storage";
import {
  invokeMock,
  setAlwaysOnTopMock,
  setDecorationsMock,
  setFocusMock,
  setPositionMock,
  setSizeMock,
  showMock,
  resetPluginStoreMock,
} from "@/test/mocks/tauri";

vi.mock("@/lib/app-windows", () => ({
  updateTaskbarVisibility: vi.fn(() => Promise.resolve()),
}));

describe("enterFloatingMode", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setPositionMock.mockClear();
    setSizeMock.mockClear();
    showMock.mockClear();
    setFocusMock.mockClear();
    setAlwaysOnTopMock.mockClear();
    resetPluginStoreMock();
    resetDesktopSettingsCache();
    resetWindowStorageCache();
    resetOverlayChromeCache();
    vi.mocked(updateTaskbarVisibility).mockClear();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "show_window_no_activate") {
        // Como no runtime: `Ok(())` chega no front como `null`.
        return Promise.resolve(null);
      }
      if (cmd === "overlay_chrome_status") {
        return Promise.resolve({
          noActivateOk: true,
          clickThrough: false,
          excludeFromCapture: false,
          topmostGuard: true,
          win32Ok: true,
        });
      }
      return Promise.resolve(true);
    });
  });

  it("falls back to setSize/setPosition when animate_window_bounds rejects", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "animate_window_bounds") {
        return Promise.reject(new Error("SetWindowPos failed"));
      }
      if (cmd === "show_window_no_activate") {
        // Como no runtime: `Ok(())` chega no front como `null`.
        return Promise.resolve(null);
      }
      if (cmd === "overlay_chrome_status") {
        return Promise.resolve({
          noActivateOk: true,
          clickThrough: false,
          excludeFromCapture: false,
          topmostGuard: true,
          win32Ok: true,
        });
      }
      return Promise.resolve(true);
    });

    await enterFloatingMode();

    expect(invokeMock).toHaveBeenCalledWith(
      "animate_window_bounds",
      expect.objectContaining({
        to: expect.objectContaining({ width: 380, height: 34 }),
      }),
    );
    expect(setSizeMock).toHaveBeenCalled();
    expect(setPositionMock).toHaveBeenCalled();
    expect(updateTaskbarVisibility).toHaveBeenCalledWith(true);
    expect(invokeMock).toHaveBeenCalledWith("show_window_no_activate");
    expect(invokeMock).toHaveBeenCalledWith("set_topmost_guard", {
      enabled: true,
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "set_window_region",
      expect.objectContaining({
        region: expect.any(Object),
      }),
    );
    expect(setFocusMock).not.toHaveBeenCalled();
    expect(setAlwaysOnTopMock).not.toHaveBeenCalled();
    // O fallback `show()` só existe para quando o comando nativo falha.
    expect(showMock).not.toHaveBeenCalled();
  });

  it("animates before applying compact window flags", async () => {
    setDecorationsMock.mockClear();

    await enterFloatingMode();

    expect(invokeMock).toHaveBeenCalled();
    expect(setDecorationsMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      invokeMock.mock.invocationCallOrder[0]!,
    );
    expect(setFocusMock).not.toHaveBeenCalled();
    expect(setAlwaysOnTopMock).not.toHaveBeenCalled();
    // O fallback `show()` só existe para quando o comando nativo falha.
    expect(showMock).not.toHaveBeenCalled();
  });
});
