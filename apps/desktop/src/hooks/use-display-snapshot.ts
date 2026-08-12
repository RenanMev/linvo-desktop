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

/** Snapshot capturado aguardando o usuário confirmar ou recortar. */
export type DraftSnapshot = {
  snapshot: DisplaySnapshot;
  previewUrl: string;
};

export type DisplaySnapshotController = {
  pending: PendingContextAttachment | null;
  draft: DraftSnapshot | null;
  isCapturing: boolean;
  isCropping: boolean;
  error: string | null;
  capture: (surface?: DisplaySurfacePreference) => Promise<void>;
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

export function useDisplaySnapshot(options?: {
  startDisplayMedia?: StartDisplayMedia;
}): DisplaySnapshotController {
  const [pending, setPending] = useState<PendingContextAttachment | null>(null);
  const [draft, setDraft] = useState<DraftSnapshot | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingContextAttachment | null>(null);
  const draftRef = useRef<DraftSnapshot | null>(null);
  const mountedRef = useRef(true);

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      revokePending(pendingRef.current);
      pendingRef.current = null;
      revokeDraft(draftRef.current);
      draftRef.current = null;
    };
  }, [revokeDraft, revokePending]);

  const capture = useCallback(
    async (surface?: DisplaySurfacePreference) => {
      setError(null);
      setIsCapturing(true);
      try {
        const snapshot = await captureDisplaySnapshot({
          startDisplayMedia:
            options?.startDisplayMedia ?? createStartDisplayMedia(surface),
        });
        if (!mountedRef.current) {
          return;
        }
        // Vai para o preview, não direto para o anexo: o usuário confere e
        // recorta antes de a imagem entrar na mensagem.
        const next: DraftSnapshot = {
          snapshot,
          previewUrl: URL.createObjectURL(snapshot.blob),
        };
        revokeDraft(draftRef.current);
        draftRef.current = next;
        setDraft(next);
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
    error,
    capture,
    confirmDraft,
    discardDraft,
    clear,
    clearError: () => setError(null),
  };
}
