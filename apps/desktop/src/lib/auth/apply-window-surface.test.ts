import { beforeEach, describe, expect, it } from "vitest";

import { applyWindowSurface } from "@/lib/auth/apply-window-surface";
import { resetOverlayChromeCache } from "@/lib/overlay-chrome";
import {
  invokeMock,
  setAlwaysOnTopMock,
  setFocusMock,
  showMock,
} from "@/test/mocks/tauri";

const okStatus = {
  noActivateOk: true,
  clickThrough: false,
  excludeFromCapture: false,
  topmostGuard: true,
  win32Ok: true,
};

function invocationOrderOf(command: string): number | undefined {
  const index = invokeMock.mock.calls.findIndex((call) => call[0] === command);
  return index === -1
    ? undefined
    : invokeMock.mock.invocationCallOrder[index];
}

describe("applyWindowSurfaceConfig", () => {
  beforeEach(() => {
    resetOverlayChromeCache();
    invokeMock.mockReset();
    setAlwaysOnTopMock.mockClear();
    setFocusMock.mockClear();
    showMock.mockClear();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "show_window_no_activate") {
        // Como no runtime: `Ok(())` chega no front como `null`.
        return Promise.resolve(null);
      }
      // Os demais comandos de chrome devolvem `OverlayChromeStatus`.
      return Promise.resolve(okStatus);
    });
  });

  it("keeps the compact surface on the native guard instead of alwaysOnTop", async () => {
    await applyWindowSurface("compact");

    expect(invokeMock).toHaveBeenCalledWith("set_topmost_guard", {
      enabled: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("show_window_no_activate");
    expect(setAlwaysOnTopMock).not.toHaveBeenCalled();
    expect(setFocusMock).not.toHaveBeenCalled();
    expect(showMock).not.toHaveBeenCalled();
  });

  it("releases the guard before dropping alwaysOnTop on the auth surface", async () => {
    await applyWindowSurface("auth");

    const guardOff = invocationOrderOf("set_topmost_guard");
    expect(guardOff).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith("set_topmost_guard", {
      enabled: false,
    });
    expect(invokeMock).toHaveBeenCalledWith("set_click_through", {
      enabled: false,
      holes: [],
    });
    // `set_topmost_guard(false)` só para de reafirmar o topmost; se ele ainda
    // estivesse ligado depois do `setAlwaysOnTop(false)`, um tick do loop
    // devolvia a tela de login para a frente de tudo.
    expect(setAlwaysOnTopMock).toHaveBeenCalledWith(false);
    expect(setAlwaysOnTopMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      guardOff!,
    );
    expect(setFocusMock).toHaveBeenCalled();
  });
});
