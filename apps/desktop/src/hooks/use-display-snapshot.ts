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
  /** Label da janela que pede a captura, para o foco voltar para ela. */
  windowLabel?: string;
};

/**
 * Se nem `result` nem `cancel` chegarem, `isCapturing` ficava preso em `true`
 * para sempre — e como a barra flutuante suprime o fechar-ao-perder-foco
 * enquanto uma captura está ativa, ela deixava de fechar até reiniciar o app.
 */
const OVERLAY_TIMEOUT_MS = 15_000;

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
  /** Devolve o anexo já pronto para o preview, para recortar de novo. */
  editPending: () => void;
  hydratePending: (input: {
    file: File;
    width: number;
    height: number;
    sourceLabel?: string;
  }) => void;
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
  const windowLabel = options?.windowLabel;
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
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Consome o overlay em voo; devolve false quando a captura é de outra janela. */
  const claimOverlayRun = useCallback(() => {
    if (!overlayRunRef.current) {
      return false;
    }
    overlayRunRef.current = false;
    if (overlayTimeoutRef.current !== null) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
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

  const hydratePending = useCallback(
    (input: {
      file: File;
      width: number;
      height: number;
      sourceLabel?: string;
    }) => {
      const next: PendingContextAttachment = {
        localId: crypto.randomUUID(),
        file: input.file,
        previewUrl: URL.createObjectURL(input.file),
        width: input.width,
        height: input.height,
        ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {}),
        status: "ready",
      };
      revokePending(pendingRef.current);
      pendingRef.current = next;
      setPending(next);
      setError(null);
    },
    [revokePending],
  );

  const discardDraft = useCallback(() => {
    revokeDraft(draftRef.current);
    draftRef.current = null;
    setDraft(null);
  }, [revokeDraft]);

  /*
   * O recorte magnético anexa direto, sem passar pelo modal de preview: o
   * usuário acabou de escolher a região vendo a tela, e o modal pedia uma
   * segunda confirmação exatamente da mesma coisa. O modal continua no caminho
   * do seletor de janela/tela, onde não houve seleção visual — e o chip abre
   * o preview quando ele quiser refinar.
   */
  const applyOverlayResult = useCallback(
    async (result: OverlayResult) => {
      // O Rust captura só a região escolhida: chegam KB, não o desktop inteiro.
      // É este comando que devolve as janelas, já com o print na mão.
      const blob = await fetchOverlayCrop(result.region, windowLabel);
      if (!mountedRef.current) {
        return;
      }
      setIsCapturing(false);

      const next = snapshotToPending({
        blob,
        mimeType: "image/png",
        filename: formatSnapshotFilename(),
        width: result.region.width,
        height: result.region.height,
        sourceLabel: "Recorte magnético",
      });
      revokePending(pendingRef.current);
      pendingRef.current = next;
      setPending(next);
    },
    [revokePending, windowLabel],
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
        // O recorte é quem devolve as janelas; se ele nem chegou ao Rust, elas
        // ficariam escondidas e o usuário sem app.
        void closeCaptureOverlay(windowLabel).catch(() => {});
        if (!mountedRef.current) {
          return;
        }
        setIsCapturing(false);
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
      if (overlayTimeoutRef.current !== null) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }
      revokePending(pendingRef.current);
      pendingRef.current = null;
      revokeDraft(draftRef.current);
      draftRef.current = null;
    };
  }, [
    applyOverlayResult,
    claimOverlayRun,
    revokeDraft,
    revokePending,
    windowLabel,
  ]);

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
        // As dimensões vêm da própria lista do seletor. Antes um
        // `captureSourceMeta` rodava em paralelo e capturava a fonte inteira de
        // novo só para lê-las — duas capturas por seleção.
        const blob = bytesToPngBlob(await captureSourceBytes(source.id));
        const size =
          source.width > 0 && source.height > 0
            ? { width: source.width, height: source.height }
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
            sourceLabel: source.title,
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

    if (overlayTimeoutRef.current !== null) {
      clearTimeout(overlayTimeoutRef.current);
    }
    overlayTimeoutRef.current = setTimeout(() => {
      overlayTimeoutRef.current = null;
      if (!overlayRunRef.current) {
        return;
      }
      overlayRunRef.current = false;
      void closeCaptureOverlay(windowLabel).catch(() => {});
      if (mountedRef.current) {
        setIsCapturing(false);
      }
    }, OVERLAY_TIMEOUT_MS);

    try {
      // O Rust esconde as nossas janelas; fazer isso daqui não esperava o
      // compositor e a janela saía como fantasma dentro da própria captura.
      await openCaptureOverlay();
    } catch (caught) {
      overlayRunRef.current = false;
      if (overlayTimeoutRef.current !== null) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }
      // Devolve as janelas escondidas pelo comando que falhou.
      try {
        await closeCaptureOverlay(windowLabel);
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
  }, [windowLabel]);

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

  /*
   * O recorte magnético anexa direto, mas quem quiser ajustar clica na
   * miniatura do chip e cai no mesmo preview de sempre. O anexo sai do chip só
   * quando o preview for confirmado ou descartado.
   */
  const editPending = useCallback(() => {
    const current = pendingRef.current;
    if (!current) {
      return;
    }
    setDraftSnapshot(
      {
        blob: current.file,
        mimeType: current.file.type === "image/jpeg" ? "image/jpeg" : "image/png",
        filename: current.file.name,
        width: current.width,
        height: current.height,
        ...(current.sourceLabel ? { sourceLabel: current.sourceLabel } : {}),
      },
      draftRef,
      setDraft,
      revokeDraft,
    );
    revokePending(current);
    pendingRef.current = null;
    setPending(null);
  }, [revokeDraft, revokePending]);

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
    editPending,
    hydratePending,
    clear,
    clearError: () => setError(null),
  };
}
