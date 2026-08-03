import { act, renderHook, waitFor } from "@testing-library/react";
import { isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setShortcutOverride: vi.fn(),
}));

vi.mock("@/context/window-chrome-context", () => ({
  useWindowChrome: () => ({
    setShortcutOverride: mocks.setShortcutOverride,
  }),
}));

import { useOnboardingBarTour } from "@/hooks/use-onboarding-bar-tour";
import { windowMock } from "@/test/mocks/tauri";

describe("useOnboardingBarTour", () => {
  let movedHandler: (() => void) | null;

  beforeEach(() => {
    vi.clearAllMocks();
    movedHandler = null;
    vi.mocked(isRegistered).mockResolvedValue(true);
    vi.mocked(windowMock.onMoved).mockImplementation(
      (async (...args: unknown[]) => {
        movedHandler = args[0] as () => void;
        return vi.fn();
      }) as never,
    );
  });

  it("marks the shortcut gesture through the temporary override", () => {
    const { result } = renderHook(() => useOnboardingBarTour());
    const override = mocks.setShortcutOverride.mock.calls[0]?.[0] as
      | (() => void)
      | undefined;

    act(() => override?.());

    expect(result.current.shortcutDone).toBe(true);
  });

  it("restores the default shortcut behavior on unmount", () => {
    const { unmount } = renderHook(() => useOnboardingBarTour());

    unmount();

    expect(mocks.setShortcutOverride).toHaveBeenLastCalledWith(null);
  });

  it("marks the drag gesture on the first move", async () => {
    const { result } = renderHook(() => useOnboardingBarTour());

    await waitFor(() => expect(windowMock.onMoved).toHaveBeenCalled());

    act(() => movedHandler?.());

    expect(result.current.dragDone).toBe(true);
  });

  it("reports the shortcut as unavailable when no alias is registered", async () => {
    vi.mocked(isRegistered).mockResolvedValue(false);

    const { result } = renderHook(() => useOnboardingBarTour());

    await waitFor(() => expect(result.current.shortcutUnavailable).toBe(true));
    expect(result.current.shortcutDone).toBe(false);
  });
});
