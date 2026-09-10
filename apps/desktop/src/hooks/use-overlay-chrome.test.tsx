import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useOverlayChrome } from "@/hooks/use-overlay-chrome";
import { resetDesktopSettingsCache } from "@/lib/desktop-settings-store";
import { resetOverlayChromeCache } from "@/lib/overlay-chrome";
import { invokeMock, pluginStoreData, resetPluginStoreMock } from "@/test/mocks/tauri";

const okStatus = {
  noActivateOk: true,
  clickThrough: false,
  excludeFromCapture: false,
  topmostGuard: true,
  win32Ok: true,
};

function guardCalls(): unknown[] {
  return invokeMock.mock.calls
    .filter((call) => call[0] === "set_topmost_guard")
    .map((call) => call[1]);
}

describe("useOverlayChrome", () => {
  beforeEach(() => {
    resetOverlayChromeCache();
    resetDesktopSettingsCache();
    resetPluginStoreMock();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(okStatus);
  });

  it("arms the guard and applies the stored hide-from-capture preference", async () => {
    pluginStoreData.set("hideFromCapture", true);

    renderHook(() => useOverlayChrome(true));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_exclude_from_capture", {
        enabled: true,
      }),
    );
    expect(guardCalls()).toContainEqual({ enabled: true });
  });

  it("releases the guard when the floating mode ends", async () => {
    const { unmount } = renderHook(() => useOverlayChrome(true));

    await waitFor(() => expect(guardCalls()).toContainEqual({ enabled: true }));

    unmount();

    // Sem isso o loop nativo seguia reafirmando topmost numa janela que já não
    // é mais a ilha.
    await waitFor(() =>
      expect(guardCalls()).toContainEqual({ enabled: false }),
    );
  });

  it("does nothing while the floating mode is off", async () => {
    renderHook(() => useOverlayChrome(false));

    await waitFor(() => expect(invokeMock).not.toHaveBeenCalled());
  });
});
