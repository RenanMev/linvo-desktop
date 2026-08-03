import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hideAllWindows: vi.fn(),
  toggleAppVisibility: vi.fn(),
  useGlobalShortcut: vi.fn(),
  useSystemTray: vi.fn(),
}));

vi.mock("@/lib/app-windows", () => ({
  hideAllWindows: mocks.hideAllWindows,
  toggleAppVisibility: mocks.toggleAppVisibility,
}));

vi.mock("@/hooks/use-global-shortcut", () => ({
  useGlobalShortcut: mocks.useGlobalShortcut,
}));

vi.mock("@/hooks/use-system-tray", () => ({
  useSystemTray: mocks.useSystemTray,
}));

import {
  WindowChromeProvider,
  useWindowChrome,
} from "@/context/window-chrome-context";

type ShortcutOptions = {
  enabled: boolean;
  onTrigger: () => void;
};

describe("WindowChromeProvider shortcut override", () => {
  let setShortcutOverride: ((handler: (() => void) | null) => void) | null;

  function Consumer() {
    setShortcutOverride = useWindowChrome().setShortcutOverride;
    return null;
  }

  function currentShortcutOptions(): ShortcutOptions {
    const call =
      mocks.useGlobalShortcut.mock.calls[
        mocks.useGlobalShortcut.mock.calls.length - 1
      ];
    if (!call) {
      throw new Error("useGlobalShortcut was not called");
    }
    return call[0] as ShortcutOptions;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setShortcutOverride = null;
  });

  it("uses the default visibility toggle without an override", () => {
    render(
      <WindowChromeProvider windowLabel="main">
        <Consumer />
      </WindowChromeProvider>,
    );

    const options = currentShortcutOptions();
    expect(options.enabled).toBe(true);

    act(() => options.onTrigger());

    expect(mocks.toggleAppVisibility).toHaveBeenCalledTimes(1);
  });

  it("uses the override and restores the default behavior", () => {
    const override = vi.fn();

    render(
      <WindowChromeProvider windowLabel="main">
        <Consumer />
      </WindowChromeProvider>,
    );

    const options = currentShortcutOptions();

    act(() => setShortcutOverride?.(override));
    act(() => options.onTrigger());

    expect(override).toHaveBeenCalledTimes(1);
    expect(mocks.toggleAppVisibility).not.toHaveBeenCalled();

    act(() => setShortcutOverride?.(null));
    act(() => options.onTrigger());

    expect(mocks.toggleAppVisibility).toHaveBeenCalledTimes(1);
  });
});
