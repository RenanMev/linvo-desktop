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

  it("parks the capture in a draft instead of attaching it directly", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockResolvedValue(
      snapshot("first.png"),
    );
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });

    // A captura vai para o preview: só vira anexo depois da confirmação.
    expect(result.current.pending).toBeNull();
    expect(result.current.draft).toMatchObject({ previewUrl: "blob:first" });
    expect(result.current.draft?.snapshot.filename).toBe("first.png");
    expect(result.current.error).toBeNull();
  });

  it("promotes the draft to a pending attachment on confirm", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockResolvedValue(
      snapshot("first.png"),
    );
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });
    await act(async () => {
      await result.current.confirmDraft();
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.pending).toMatchObject({
      previewUrl: "blob:second",
      width: 800,
      height: 600,
      sourceLabel: "Browser",
      status: "ready",
    });
    expect(result.current.pending?.file).toBeInstanceOf(File);
    expect(result.current.pending?.file.name).toBe("first.png");
    // O preview do rascunho é liberado ao virar anexo.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });

  it("crops the draft when a region is confirmed", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockResolvedValue(
      snapshot("first.png"),
    );
    const cropped = { ...snapshot("cropped.png"), width: 100, height: 50 };
    const crop = vi
      .spyOn(snapshotModule, "cropDisplaySnapshot")
      .mockResolvedValue(cropped);
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });
    const region = { x: 10, y: 20, width: 100, height: 50 };
    await act(async () => {
      await result.current.confirmDraft(region);
    });

    expect(crop).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "first.png" }),
      region,
    );
    expect(result.current.pending).toMatchObject({ width: 100, height: 50 });
  });

  it("drops the draft without attaching when discarded", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockResolvedValue(
      snapshot("first.png"),
    );
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });
    act(() => {
      result.current.discardDraft();
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.pending).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });

  it("revokes the attachment preview when clearing and unmounting", async () => {
    vi.spyOn(snapshotModule, "captureDisplaySnapshot").mockResolvedValue(
      snapshot("first.png"),
    );
    const { result, unmount } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.capture();
    });
    await act(async () => {
      await result.current.confirmDraft();
    });
    act(() => {
      result.current.clear();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
    expect(result.current.pending).toBeNull();

    unmount();
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
