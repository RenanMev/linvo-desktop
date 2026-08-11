import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDisplaySnapshot } from "@/hooks/use-display-snapshot";
import * as snapshotModule from "@/lib/context-capture/display-snapshot";

describe("useDisplaySnapshot", () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    createObjectURL
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("creates a pending attachment from a captured snapshot", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockResolvedValue(
      snapshot("first.png"),
    );
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });

    expect(result.current.pending).toMatchObject({
      previewUrl: "blob:first",
      width: 800,
      height: 600,
      sourceLabel: "Browser",
      status: "ready",
    });
    expect(result.current.pending?.file).toBeInstanceOf(File);
    expect(result.current.pending?.file.name).toBe("first.png");
    expect(result.current.error).toBeNull();
  });

  it("revokes the previous preview when replacing a capture", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot")
      .mockResolvedValueOnce(snapshot("first.png"))
      .mockResolvedValueOnce(snapshot("second.png"));
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
      await result.current.capture();
    });

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
    expect(result.current.pending?.previewUrl).toBe("blob:second");
  });

  it("revokes the preview when clearing and unmounting", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockResolvedValue(
      snapshot("first.png"),
    );
    const first = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await first.result.current.capture();
    });
    act(() => {
      first.result.current.clear();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
    expect(first.result.current.pending).toBeNull();

    const second = renderHook(() => useDisplaySnapshot());
    await act(async () => {
      await second.result.current.capture();
    });
    second.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
  });

  it("keeps cancellation silent", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockRejectedValue(
      new snapshotModule.DisplaySnapshotCancelledError(),
    );
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });

    expect(result.current.pending).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isCapturing).toBe(false);
  });

  it("exposes unexpected capture errors and clears them", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockRejectedValue(
      new Error("Falha no dispositivo"),
    );
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });
    expect(result.current.error).toBe("Falha no dispositivo");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("does not create a preview after unmounting during capture", async () => {
    let resolveSnapshot!: (value: snapshotModule.DisplaySnapshot) => void;
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockReturnValue(
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    );
    const rendered = renderHook(() => useDisplaySnapshot());

    let capturePromise!: Promise<void>;
    act(() => {
      capturePromise = rendered.result.current.capture();
    });
    rendered.unmount();
    await act(async () => {
      resolveSnapshot(snapshot("late.png"));
      await capturePromise;
    });

    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

function snapshot(filename: string): snapshotModule.DisplaySnapshot {
  return {
    blob: new Blob(["image"], { type: "image/png" }),
    mimeType: "image/png",
    filename,
    width: 800,
    height: 600,
    sourceLabel: "Browser",
  };
}
