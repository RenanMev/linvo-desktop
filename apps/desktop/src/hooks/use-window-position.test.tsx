import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWindowPosition } from "@/hooks/use-window-position";
import {
  loadSavedAnchor,
  loadSavedPosition,
  saveSavedAnchor,
  saveSavedPosition,
} from "@/lib/window-storage";
import {
  invokeMock,
  setPositionMock,
  windowMock,
} from "@/test/mocks/tauri";

type MovedHandler = () => void;
type OnMovedMock = (cb: MovedHandler) => Promise<() => void>;

function captureMovedHandler(): () => MovedHandler {
  let handler: MovedHandler = () => {};
  (windowMock.onMoved as unknown as { mockImplementation: (fn: OnMovedMock) => void }).mockImplementation(
    (cb) => {
      handler = cb;
      return Promise.resolve(() => {});
    },
  );
  return () => handler;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

describe("useWindowPosition — magnetic snap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "monitor_work_area") {
        return Promise.resolve(WORK_AREA);
      }
      return Promise.resolve(true);
    });
    windowMock.outerPosition.mockReset();
    windowMock.outerSize.mockReset();
    windowMock.outerSize.mockResolvedValue({ width: 168, height: 34 });
    windowMock.onMoved.mockReset();
    setPositionMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not resolve snap before the 180ms silence elapses", async () => {
    const getHandler = captureMovedHandler();
    windowMock.outerPosition.mockResolvedValue({ x: 10, y: 400 });

    renderHook(() =>
      useWindowPosition({ shouldPersist: () => true, enabled: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    invokeMock.mockClear();

    getHandler()();

    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    expect(invokeMock).not.toHaveBeenCalledWith("monitor_work_area");
  });

  it("reapplies a saved anchor against the current monitor work area", async () => {
    captureMovedHandler();
    saveSavedPosition({ x: 1_000, y: 300 });
    saveSavedAnchor({ horizontal: "right", vertical: null });

    renderHook(() =>
      useWindowPosition({ shouldPersist: () => true, enabled: true }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setPositionMock).toHaveBeenCalledWith(
      expect.objectContaining({ x: 1_920 - 168, y: 300 }),
    );
  });

  it("snaps to the edge and persists the anchored position when within the zone", async () => {
    const getHandler = captureMovedHandler();
    windowMock.outerPosition.mockResolvedValue({ x: 10, y: 400 });

    renderHook(() =>
      useWindowPosition({ shouldPersist: () => true, enabled: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    getHandler()();

    await act(async () => {
      vi.advanceTimersByTime(180);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadSavedPosition()).toEqual({ x: 0, y: 400 });
    expect(loadSavedAnchor()).toEqual({ horizontal: "left", vertical: null });
  });

  it("persists the free position and a null anchor when outside every zone", async () => {
    const getHandler = captureMovedHandler();
    windowMock.outerPosition.mockResolvedValue({ x: 800, y: 500 });

    renderHook(() =>
      useWindowPosition({ shouldPersist: () => true, enabled: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    getHandler()();

    await act(async () => {
      vi.advanceTimersByTime(180);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadSavedPosition()).toEqual({ x: 800, y: 500 });
    expect(loadSavedAnchor()).toEqual({ horizontal: null, vertical: null });
  });

  it("persists a separate window without overwriting the main window anchor", async () => {
    const storageKey = "linvo:test:checklist-position";
    const getHandler = captureMovedHandler();
    saveSavedAnchor({ horizontal: "right", vertical: null });
    windowMock.outerPosition.mockResolvedValue({ x: 10, y: 400 });

    renderHook(() =>
      useWindowPosition({
        shouldPersist: () => true,
        enabled: true,
        storageKey,
        snapToEdges: false,
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    getHandler()();

    await act(async () => {
      vi.advanceTimersByTime(180);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadSavedPosition(storageKey)).toEqual({ x: 10, y: 400 });
    expect(loadSavedAnchor()).toEqual({ horizontal: "right", vertical: null });
  });

  it("ignores onMoved events fired by its own snap animation", async () => {
    const getHandler = captureMovedHandler();
    windowMock.outerPosition.mockResolvedValue({ x: 10, y: 400 });

    const gate = deferred<boolean>();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "monitor_work_area") {
        return Promise.resolve(WORK_AREA);
      }
      return gate.promise;
    });

    renderHook(() =>
      useWindowPosition({ shouldPersist: () => true, enabled: true }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    invokeMock.mockClear();

    getHandler()();
    await act(async () => {
      vi.advanceTimersByTime(180);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // A janela "se move" enquanto a própria animação de snap está em curso
    // (suppressed === true nesse ponto, pois estamos presos no `gate`).
    getHandler()();
    await act(async () => {
      vi.advanceTimersByTime(180);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    gate.resolve(true);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const workAreaCalls = invokeMock.mock.calls.filter(
      ([cmd]) => cmd === "monitor_work_area",
    );
    expect(workAreaCalls).toHaveLength(1);
  });

  it("does not subscribe to onMoved when disabled", () => {
    const onMovedSpy = vi.mocked(windowMock.onMoved);

    renderHook(() =>
      useWindowPosition({ shouldPersist: () => true, enabled: false }),
    );

    expect(onMovedSpy).not.toHaveBeenCalled();
  });
});
