import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@linvo/shared";

import { AppearanceProvider, useAppearance } from "@/context/appearance-context";
import * as appearanceApi from "@/lib/appearance/appearance-api";
import {
  clearStoredAppearance,
  hasPendingSync,
  loadStoredAppearance,
  saveStoredAppearance,
} from "@/lib/appearance/appearance-store";
import { AUTH_SYNC_EVENT, TOKEN_SYNC_EVENT } from "@/lib/auth-sync";
import { emitMock, listenMock } from "@/test/mocks/tauri";

vi.mock("@/lib/appearance/appearance-api", () => ({
  fetchAppearance: vi.fn(),
  patchAppearance: vi.fn(),
}));

function makePrefs(
  overrides: Partial<AppearancePreferences> = {},
): AppearancePreferences {
  return {
    ...APPEARANCE_DEFAULTS,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockMatchMedia(prefersDark = false) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("dark") ? prefersDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("AppearanceProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    vi.mocked(appearanceApi.fetchAppearance).mockResolvedValue(makePrefs());
    vi.mocked(appearanceApi.patchAppearance).mockResolvedValue(makePrefs());
    emitMock.mockClear();
    emitMock.mockResolvedValue(undefined);
    listenMock.mockClear();
    mockMatchMedia(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearStoredAppearance();
  });

  it("initializes preferences from the local envelope when present", async () => {
    saveStoredAppearance(makePrefs({ themeMode: "dark", panelOpacity: 90 }));

    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel" readOnly>
          {children}
        </AppearanceProvider>
      ),
    });

    expect(result.current.preferences.themeMode).toBe("dark");
    expect(result.current.preferences.panelOpacity).toBe(90);
  });

  it("applies the dark class to the document root on mount when the OS prefers dark", () => {
    mockMatchMedia(true);

    renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel" readOnly>
          {children}
        </AppearanceProvider>
      ),
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies setPreference to the DOM synchronously, before any await resolves", () => {
    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel" readOnly>
          {children}
        </AppearanceProvider>
      ),
    });

    act(() => {
      result.current.setPreference("panelOpacity", 88);
    });

    expect(
      document.documentElement.style.getPropertyValue("--panel-tint"),
    ).toContain("0.88");
  });

  it("does not call patchAppearance in readOnly mode", async () => {
    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="main" readOnly>
          {children}
        </AppearanceProvider>
      ),
    });

    act(() => {
      result.current.setPreference("themeMode", "dark");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(appearanceApi.patchAppearance).not.toHaveBeenCalled();
  });

  it("debounces the PATCH call by 400ms when preferences change quickly", async () => {
    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(appearanceApi.patchAppearance).mockClear();

    act(() => {
      result.current.setPreference("panelOpacity", 70);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.setPreference("panelOpacity", 80);
    });

    expect(appearanceApi.patchAppearance).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(appearanceApi.patchAppearance).toHaveBeenCalledTimes(1);
    expect(appearanceApi.patchAppearance).toHaveBeenCalledWith({
      panelOpacity: 80,
    });
  });

  it("keeps the local value applied and marks pendingSync when PATCH fails", async () => {
    vi.mocked(appearanceApi.patchAppearance).mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setPreference("themeMode", "dark");
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(result.current.preferences.themeMode).toBe("dark");
    expect(hasPendingSync()).toBe(true);
  });

  it("adopts server preferences on boot when they are newer than local", async () => {
    saveStoredAppearance(makePrefs({ themeMode: "light", updatedAt: "2025-01-01T00:00:00.000Z" }));
    vi.mocked(appearanceApi.fetchAppearance).mockResolvedValue(
      makePrefs({ themeMode: "dark", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );

    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.preferences.themeMode).toBe("dark");
  });

  it("pushes local preferences to the server on boot when local is newer", async () => {
    saveStoredAppearance(
      makePrefs({ themeMode: "dark", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );
    vi.mocked(appearanceApi.fetchAppearance).mockResolvedValue(
      makePrefs({ themeMode: "light", updatedAt: "2025-01-01T00:00:00.000Z" }),
    );

    renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(appearanceApi.patchAppearance).toHaveBeenCalledWith(
      expect.objectContaining({ themeMode: "dark" }),
    );
  });

  it("does not overwrite a local change made while the initial GET is pending", async () => {
    const fetchResult = deferred<AppearancePreferences>();
    vi.mocked(appearanceApi.fetchAppearance).mockReturnValue(
      fetchResult.promise,
    );

    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    act(() => {
      result.current.setPreference("themeMode", "dark");
    });

    await act(async () => {
      fetchResult.resolve(
        makePrefs({
          themeMode: "light",
          updatedAt: "2026-06-01T00:00:00.000Z",
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.preferences.themeMode).toBe("dark");
  });

  it("serializes PATCHes and ignores an older response after a newer local change", async () => {
    const firstPatch = deferred<AppearancePreferences>();
    const secondPatch = deferred<AppearancePreferences>();

    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    vi.mocked(appearanceApi.patchAppearance)
      .mockReset()
      .mockReturnValueOnce(firstPatch.promise)
      .mockReturnValueOnce(secondPatch.promise);

    act(() => {
      result.current.setPreference("panelOpacity", 70);
      vi.advanceTimersByTime(400);
    });
    expect(appearanceApi.patchAppearance).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setPreference("panelOpacity", 80);
      vi.advanceTimersByTime(400);
    });
    expect(appearanceApi.patchAppearance).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstPatch.resolve(
        makePrefs({
          panelOpacity: 70,
          updatedAt: "2026-06-01T00:00:01.000Z",
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.preferences.panelOpacity).toBe(80);
    expect(appearanceApi.patchAppearance).toHaveBeenCalledTimes(2);
    expect(appearanceApi.patchAppearance).toHaveBeenLastCalledWith({
      panelOpacity: 80,
    });

    await act(async () => {
      secondPatch.resolve(
        makePrefs({
          panelOpacity: 80,
          updatedAt: "2026-06-01T00:00:02.000Z",
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.preferences.panelOpacity).toBe(80);
  });

  it("resets local appearance when logout is broadcast by the current window", async () => {
    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="main" readOnly>
          {children}
        </AppearanceProvider>
      ),
    });

    act(() => {
      result.current.setPreference("themeMode", "dark");
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const authListener = listenMock.mock.calls.find(
      ([eventName]) => eventName === AUTH_SYNC_EVENT,
    )?.[1] as
      | ((event: {
          payload: { type: "logout"; source: string };
        }) => void)
      | undefined;

    expect(authListener).toBeDefined();
    act(() => {
      authListener?.({
        payload: { type: "logout", source: "main" },
      });
    });

    expect(result.current.preferences.themeMode).toBe(
      APPEARANCE_DEFAULTS.themeMode,
    );
    expect(loadStoredAppearance()).toBeNull();
    expect(hasPendingSync()).toBe(false);
  });

  it("keeps defaults unpersisted after logout until the next account GET resolves", async () => {
    const previousAccountFetch = deferred<AppearancePreferences>();
    const nextAccountFetch = deferred<AppearancePreferences>();
    vi.mocked(appearanceApi.fetchAppearance)
      .mockReset()
      .mockReturnValueOnce(previousAccountFetch.promise)
      .mockReturnValueOnce(nextAccountFetch.promise);

    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const authListener = listenMock.mock.calls.find(
      ([eventName]) => eventName === AUTH_SYNC_EVENT,
    )?.[1] as
      | ((event: {
          payload: { type: "logout"; source: string };
        }) => void)
      | undefined;
    const tokenListener = listenMock.mock.calls.find(
      ([eventName]) => eventName === TOKEN_SYNC_EVENT,
    )?.[1] as
      | ((event: {
          payload: {
            accessToken: string;
            refreshToken: string;
            source: string;
          };
        }) => void)
      | undefined;

    act(() => {
      result.current.setPreference("themeMode", "dark");
      authListener?.({
        payload: { type: "logout", source: "main" },
      });
    });

    expect(result.current.preferences.themeMode).toBe(
      APPEARANCE_DEFAULTS.themeMode,
    );
    expect(loadStoredAppearance()).toBeNull();

    act(() => {
      tokenListener?.({
        payload: {
          accessToken: "access-b",
          refreshToken: "refresh-b",
          source: "panel",
        },
      });
    });

    await act(async () => {
      nextAccountFetch.resolve(
        makePrefs({
          themeMode: "light",
          accentColor: "amber",
          updatedAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.preferences.accentColor).toBe("amber");
    expect(loadStoredAppearance()?.prefs.accentColor).toBe("amber");

    previousAccountFetch.resolve(makePrefs({ themeMode: "dark" }));
  });

  it("resets to defaults and persists them", async () => {
    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider windowLabel="panel">{children}</AppearanceProvider>
      ),
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setPreference("themeMode", "dark");
    });

    await act(async () => {
      result.current.resetToDefaults();
      await Promise.resolve();
    });

    expect(result.current.preferences.themeMode).toBe(
      APPEARANCE_DEFAULTS.themeMode,
    );
    expect(loadStoredAppearance()?.prefs.themeMode).toBe(
      APPEARANCE_DEFAULTS.themeMode,
    );
  });
});
