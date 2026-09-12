import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompactClickThrough } from "@/hooks/use-compact-click-through";
import { setClickThrough } from "@/lib/overlay-chrome";

vi.mock("@/lib/overlay-chrome", async () => {
  const actual = await vi.importActual<typeof import("@/lib/overlay-chrome")>(
    "@/lib/overlay-chrome",
  );
  return {
    ...actual,
    setClickThrough: vi.fn(() => Promise.resolve()),
  };
});

describe("useCompactClickThrough", () => {
  beforeEach(() => {
    vi.mocked(setClickThrough).mockClear();
    document.body.innerHTML = "";
  });

  it("sends holes for overlay hit targets in compact mode", async () => {
    const target = document.createElement("button");
    target.setAttribute("data-overlay-hit", "");
    target.getBoundingClientRect = () =>
      ({
        left: 8,
        top: 4,
        width: 16,
        height: 12,
        right: 24,
        bottom: 16,
        x: 8,
        y: 4,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(target);

    renderHook(() =>
      useCompactClickThrough({ mode: "compact", suspended: false }),
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    await waitFor(() =>
      expect(setClickThrough).toHaveBeenCalledWith({
        enabled: true,
        holes: [expect.objectContaining({ width: 28, height: 24 })],
      }),
    );
  });

  it("disables click-through when the hook unmounts", async () => {
    const { unmount } = renderHook(() =>
      useCompactClickThrough({ mode: "compact", suspended: false }),
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    unmount();

    await waitFor(() =>
      expect(setClickThrough).toHaveBeenCalledWith({
        enabled: false,
        holes: [],
      }),
    );
  });

  it("disables click-through while a transition is suspended", async () => {
    renderHook(() =>
      useCompactClickThrough({ mode: "compact", suspended: true }),
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    await waitFor(() =>
      expect(setClickThrough).toHaveBeenCalledWith({
        enabled: false,
        holes: [],
      }),
    );
  });

  it("keeps click-through off until hit targets have size", async () => {
    const target = document.createElement("button");
    target.setAttribute("data-overlay-hit", "");
    target.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(target);

    renderHook(() =>
      useCompactClickThrough({ mode: "compact", suspended: false }),
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    await waitFor(() =>
      expect(setClickThrough).toHaveBeenCalledWith({
        enabled: false,
        holes: [],
      }),
    );
    expect(setClickThrough).not.toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });
});
