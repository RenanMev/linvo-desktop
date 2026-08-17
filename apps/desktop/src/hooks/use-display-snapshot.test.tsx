import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDisplaySnapshot } from "@/hooks/use-display-snapshot";
import * as captureSources from "@/lib/context-capture/capture-sources";
import * as snapshotModule from "@/lib/context-capture/display-snapshot";
import { invokeMock } from "@/test/mocks/tauri";

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

  it("leaves window hiding to the overlay command", async () => {
    invokeMock.mockClear();
    const open = vi
      .spyOn(captureSources, "openCaptureOverlay")
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.startMagneticCapture();
    });

    expect(open).toHaveBeenCalledOnce();
    // Esconder daqui deixava a janela como fantasma dentro da própria captura:
    // quem esconde, espera o compositor e congela é o Rust, em ordem.
    expect(invokeMock).not.toHaveBeenCalledWith("panel_close");
    expect(result.current.isCapturing).toBe(true);
  });

  it("ignores an overlay result it did not ask for", async () => {
    let resultHandler:
      | ((value: captureSources.OverlayResult) => void)
      | undefined;
    vi.spyOn(captureSources, "listenOverlayResult").mockImplementation(
      (handler) => {
        resultHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    const crop = vi.spyOn(captureSources, "fetchOverlayCrop");
    const { result } = renderHook(() => useDisplaySnapshot());

    // Recorte disparado pela outra janela: o evento é global e chega aqui também.
    await act(async () => {
      resultHandler?.({ region: { x: 0, y: 0, width: 50, height: 50 } });
      await Promise.resolve();
    });

    expect(result.current.draft).toBeNull();
    expect(crop).not.toHaveBeenCalled();
  });

  it("attaches the magnetic crop straight away, without the preview dialog", async () => {
    let resultHandler:
      | ((value: captureSources.OverlayResult) => void)
      | undefined;
    vi.spyOn(captureSources, "listenOverlayResult").mockImplementation(
      (handler) => {
        resultHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    vi.spyOn(captureSources, "openCaptureOverlay").mockResolvedValue(undefined);
    const crop = vi
      .spyOn(captureSources, "fetchOverlayCrop")
      .mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    const { result } = renderHook(() => useDisplaySnapshot());
    await act(async () => {
      await result.current.startMagneticCapture();
    });

    const region = { x: 10, y: 20, width: 300, height: 200 };
    await act(async () => {
      resultHandler?.({ region });
      await Promise.resolve();
    });

    // Só a região trafega; os pixels saem do Rust já recortados.
    expect(crop).toHaveBeenCalledWith(region, undefined);
    /*
     * Vai direto para o chip: o usuário escolheu a região vendo a tela, e o
     * modal de preview pedia uma segunda confirmação da mesma coisa.
     */
    expect(result.current.draft).toBeNull();
    expect(result.current.pending).toMatchObject({
      width: 300,
      height: 200,
      sourceLabel: "Recorte magnético",
      status: "ready",
    });
    expect(result.current.isCapturing).toBe(false);
  });

  it("hands the attached crop back to the preview when asked to edit it", async () => {
    let resultHandler:
      | ((value: captureSources.OverlayResult) => void)
      | undefined;
    vi.spyOn(captureSources, "listenOverlayResult").mockImplementation(
      (handler) => {
        resultHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    vi.spyOn(captureSources, "openCaptureOverlay").mockResolvedValue(undefined);
    vi.spyOn(captureSources, "fetchOverlayCrop").mockResolvedValue(
      new Blob(["png"], { type: "image/png" }),
    );

    const { result } = renderHook(() => useDisplaySnapshot());
    await act(async () => {
      await result.current.startMagneticCapture();
    });
    await act(async () => {
      resultHandler?.({ region: { x: 0, y: 0, width: 300, height: 200 } });
      await Promise.resolve();
    });

    act(() => {
      result.current.editPending();
    });

    // O anexo sai do chip e volta a ser rascunho, para poder recortar de novo.
    expect(result.current.pending).toBeNull();
    expect(result.current.draft?.snapshot).toMatchObject({
      width: 300,
      height: 200,
      sourceLabel: "Recorte magnético",
    });
  });

  it("closes the overlay when it fails to open, restoring the windows", async () => {
    vi.spyOn(captureSources, "openCaptureOverlay").mockRejectedValue(
      new Error("overlay indisponível"),
    );
    const close = vi
      .spyOn(captureSources, "closeCaptureOverlay")
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useDisplaySnapshot());

    await act(async () => {
      await result.current.startMagneticCapture();
    });

    expect(close).toHaveBeenCalledOnce();
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBe("overlay indisponível");
  });

  it("restores the windows when the crop invoke never reaches Rust", async () => {
    let resultHandler:
      | ((value: captureSources.OverlayResult) => void)
      | undefined;
    vi.spyOn(captureSources, "listenOverlayResult").mockImplementation(
      (handler) => {
        resultHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    vi.spyOn(captureSources, "openCaptureOverlay").mockResolvedValue(undefined);
    vi.spyOn(captureSources, "fetchOverlayCrop").mockRejectedValue(
      new Error("not allowed"),
    );
    const close = vi
      .spyOn(captureSources, "closeCaptureOverlay")
      .mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDisplaySnapshot({ windowLabel: "panel" }),
    );
    await act(async () => {
      await result.current.startMagneticCapture();
    });
    await act(async () => {
      resultHandler?.({ region: { x: 0, y: 0, width: 100, height: 80 } });
      await Promise.resolve();
    });

    expect(close).toHaveBeenCalledWith("panel");
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBe("not allowed");
  });

  it("passes the requesting window label into the crop restore", async () => {
    let resultHandler:
      | ((value: captureSources.OverlayResult) => void)
      | undefined;
    vi.spyOn(captureSources, "listenOverlayResult").mockImplementation(
      (handler) => {
        resultHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    vi.spyOn(captureSources, "openCaptureOverlay").mockResolvedValue(undefined);
    const crop = vi
      .spyOn(captureSources, "fetchOverlayCrop")
      .mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    const { result } = renderHook(() =>
      useDisplaySnapshot({ windowLabel: "panel" }),
    );
    await act(async () => {
      await result.current.startMagneticCapture();
    });

    const region = { x: 4, y: 8, width: 120, height: 90 };
    await act(async () => {
      resultHandler?.({ region });
      await Promise.resolve();
    });

    expect(crop).toHaveBeenCalledWith(region, "panel");
  });

  it("hydratePending installs a ready attachment", () => {
    const { result } = renderHook(() => useDisplaySnapshot());
    const file = new File([new Uint8Array([9, 9])], "handoff.png", {
      type: "image/png",
    });

    act(() => {
      result.current.hydratePending({
        file,
        width: 40,
        height: 30,
        sourceLabel: "Recorte",
      });
    });

    expect(result.current.pending).toMatchObject({
      status: "ready",
      width: 40,
      height: 30,
      sourceLabel: "Recorte",
      previewUrl: "blob:first",
      file,
    });
    expect(createObjectURL).toHaveBeenCalled();
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
