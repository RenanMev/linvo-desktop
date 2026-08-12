import { useCallback, useEffect, useRef, useState } from "react";

import {
  DisplaySnapshotCancelledError,
  captureDisplaySnapshot,
  createStartDisplayMedia,
  cropDisplaySnapshot,
  type DisplaySnapshot,
  type DisplaySurfacePreference,
  type StartDisplayMedia,
} from "@/lib/context-capture/display-snapshot";
import {
  bytesToPngBlob,
  captureSourceBytes,
  captureSourceMeta,
  closeCaptureOverlay,
  fetchOverlayCrop,
  listenOverlayCancel,
  listenOverlayResult,
  openCaptureOverlay,
  type CaptureSource,
  type OverlayResult,
} from "@/lib/context-capture/capture-sources";
import type { Rect } from "@/lib/context-capture/crop";

export type PendingContextAttachment = {
  localId: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  sourceLabel?: string;
  status: "ready" | "capturing" | "error";
  errorMessage?: string;
};

export type DraftSnapshot = {
  snapshot: DisplaySnapshot;
  previewUrl: string;
};

export type UseDisplaySnapshotOptions = {
  startDisplayMedia?: StartDisplayMedia;
};

export type DisplaySnapshotController = {
  pending: PendingContextAttachment | null;
  draft: DraftSnapshot | null;
  isCapturing: boolean;
  isCropping: boolean;
  pickerOpen: boolean;
  error: string | null;
  capture: (surface?: DisplaySurfacePreference) => Promise<void>;
  openPicker: () => void;
  closePicker: () => void;
  captureNativeSource: (source: CaptureSource) => Promise<void>;
  startMagneticCapture: () => Promise<void>;
  confirmDraft: (region?: Rect | null) => Promise<void>;
  discardDraft: () => void;
  clear: () => void;
  clearError: () => void;
};

function snapshotToPending(snapshot: DisplaySnapshot): PendingContextAttachment {
  const file = new File([snapshot.blob], snapshot.filename, {
    type: snapshot.mimeType,
  });
  return {
    localId: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(snapshot.blob),
    width: snapshot.width,
    height: snapshot.height,
    ...(snapshot.sourceLabel ? { sourceLabel: snapshot.sourceLabel } : {}),
    status: "ready",
  };
}

function formatSnapshotFilename(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `context-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
}

async function blobImageSize(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Falha ao ler a imagem"));
      image.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setDraftSnapshot(
  snapshot: DisplaySnapshot,
  draftRef: { current: DraftSnapshot | null },
  setDraft: (value: DraftSnapshot | null) => void,
  revokeDraft: (value: DraftSnapshot | null) => void,
) {
  const next: DraftSnapshot = {
    snapshot,
    previewUrl: URL.createObjectURL(snapshot.blob),
  };
  revokeDraft(draftRef.current);
  draftRef.current = next;
  setDraft(next);
}

export function useDisplaySnapshot(
  options?: UseDisplaySnapshotOptions,
): DisplaySnapshotController {
  const [pending, setPending] = useState<PendingContextAttachment | null>(null);
  const [draft, setDraft] = useState<DraftSnapshot | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingContextAttachment | null>(null);
  const draftRef = useRef<DraftSnapshot | null>(null);
  const mountedRef = useRef(true);
  /*
   * Os hooks do overlay vêm em um objeto novo a cada render do chamador; guardá-los
   * numa ref evita reassinar os listeners de `capture-overlay://*` sem parar.
   */
  /*
   * `capture-overlay://result` é global: o painel e a barra flutuante escutam o
   * mesmo evento. Sem marcar quem pediu a captura, um recorte feito no chat
   * flutuante também viraria rascunho no painel.
   */
  const overlayRunRef = useRef(false);

  /** Consome o overlay em voo; devolve false quando a captura é de outra janela. */
  const claimOverlayRun = useCallback(() => {
    if (!overlayRunRef.current) {
      return false;
    }
    overlayRunRef.current = false;
    return true;
  }, []);

  const revokePending = useCallback(
    (attachment: PendingContextAttachment | null) => {
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    },
    [],
  );

  const revokeDraft = useCallback((value: DraftSnapshot | null) => {
    if (value?.previewUrl) {
      URL.revokeObjectURL(value.previewUrl);
    }
  }, []);

  const clear = useCallback(() => {
    revokePending(pendingRef.current);
    pendingRef.current = null;
    setPending(null);
  }, [revokePending]);

  const discardDraft = useCallback(() => {
    revokeDraft(draftRef.current);
    draftRef.current = null;
    setDraft(null);
  }, [revokeDraft]);

  const applyOverlayResult = useCallback(
    async (result: OverlayResult) => {
      // O Rust já devolve a região recortada: chegam KB, não o desktop inteiro.
      const blob = await fetchOverlayCrop(result.region);
      if (!mountedRef.current) {
        return;
      }
      setIsCapturing(false);
      setDraftSnapshot(
        {
          blob,
          mimeType: "image/png",
          filename: formatSnapshotFilename(),
          width: result.region.width,
          height: result.region.height,
          sourceLabel: "Recorte magnético",
        },
        draftRef,
        setDraft,
        revokeDraft,
      );
    },
    [revokeDraft],
  );

  useEffect(() => {
    mountedRef.current = true;
    let unlistenResult: (() => void) | undefined;
    let unlistenCancel: (() => void) | undefined;

    void listenOverlayResult((result) => {
      if (!claimOverlayRun()) {
        return;
      }
      void applyOverlayResult(result).catch((caught) => {
        if (!mountedRef.current) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível aplicar o recorte",
        );
      });
    }).then((fn) => {
      unlistenResult = fn;
    });

    void listenOverlayCancel(() => {
      if (!claimOverlayRun()) {
        return;
      }
      if (mountedRef.current) {
        setIsCapturing(false);
      }
    }).then((fn) => {
      unlistenCancel = fn;
    });

    return () => {
      mountedRef.current = false;
      unlistenResult?.();
      unlistenCancel?.();
      revokePending(pendingRef.current);
      pendingRef.current = null;
      revokeDraft(draftRef.current);
      draftRef.current = null;
    };
  }, [applyOverlayResult, claimOverlayRun, revokeDraft, revokePending]);

  const capture = useCallback(
    async (surface?: DisplaySurfacePreference) => {
      setError(null);
      setIsCapturing(true);
      setPickerOpen(false);
      try {
        const snapshot = await captureDisplaySnapshot({
          startDisplayMedia:
            options?.startDisplayMedia ?? createStartDisplayMedia(surface),
        });
        if (!mountedRef.current) {
          return;
        }
        setDraftSnapshot(snapshot, draftRef, setDraft, revokeDraft);
      } catch (caught) {
        if (!mountedRef.current) {
          return;
        }
        if (caught instanceof DisplaySnapshotCancelledError) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível capturar a tela",
        );
      } finally {
        if (mountedRef.current) {
          setIsCapturing(false);
        }
      }
    },
    [options?.startDisplayMedia, revokeDraft],
  );

  const captureNativeSource = useCallback(
    async (source: CaptureSource) => {
      setError(null);
      setIsCapturing(true);
      setPickerOpen(false);
      try {
        const [bytes, meta] = await Promise.all([
          captureSourceBytes(source.id),
          captureSourceMeta(source.id),
        ]);
        const blob = bytesToPngBlob(bytes);
        const size =
          meta.width > 0 && meta.height > 0
            ? { width: meta.width, height: meta.height }
            : await blobImageSize(blob);
        if (!mountedRef.current) {
          return;
        }
        setDraftSnapshot(
          {
            blob,
            mimeType: "image/png",
            filename: formatSnapshotFilename(),
            width: size.width,
            height: size.height,
            sourceLabel: meta.title || source.title,
          },
          draftRef,
          setDraft,
          revokeDraft,
        );
      } catch (caught) {
        if (!mountedRef.current) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível capturar a fonte",
        );
      } finally {
        if (mountedRef.current) {
          setIsCapturing(false);
        }
      }
    },
    [revokeDraft],
  );

  const startMagneticCapture = useCallback(async () => {
    setError(null);
    setIsCapturing(true);
    setPickerOpen(false);
    overlayRunRef.current = true;
    try {
      // O Rust esconde as nossas janelas, espera o compositor e só então
      // congela — fazer isso daqui deixava a janela como fantasma na captura.
      await openCaptureOverlay();
    } catch (caught) {
      overlayRunRef.current = false;
      // Devolve as janelas escondidas pelo comando que falhou.
      try {
        await closeCaptureOverlay();
      } catch {
      }
      if (!mountedRef.current) {
        return;
      }
      setIsCapturing(false);
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível abrir o recorte magnético",
      );
    }
  }, []);

  const confirmDraft = useCallback(
    async (region?: Rect | null) => {
      const current = draftRef.current;
      if (!current) {
        return;
      }

      setIsCropping(true);
      setError(null);
      try {
        const finalSnapshot = region
          ? await cropDisplaySnapshot(current.snapshot, region)
          : current.snapshot;

        if (!mountedRef.current) {
          return;
        }

        const next = snapshotToPending(finalSnapshot);
        revokePending(pendingRef.current);
        pendingRef.current = next;
        setPending(next);

        revokeDraft(draftRef.current);
        draftRef.current = null;
        setDraft(null);
      } catch (caught) {
        if (!mountedRef.current) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível recortar a imagem",
        );
      } finally {
        if (mountedRef.current) {
          setIsCropping(false);
        }
      }
    },
    [revokeDraft, revokePending],
  );

  return {
    pending,
    draft,
    isCapturing,
    isCropping,
    pickerOpen,
    error,
    capture,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    captureNativeSource,
    startMagneticCapture,
    confirmDraft,
    discardDraft,
    clear,
    clearError: () => setError(null),
  };
}
