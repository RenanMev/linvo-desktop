import { useCallback, useEffect, useRef, useState } from "react";

import {
  DisplaySnapshotCancelledError,
  captureDisplaySnapshot,
  type DisplaySnapshot,
  type StartDisplayMedia,
} from "@/lib/context-capture/display-snapshot";

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

export type DisplaySnapshotController = {
  pending: PendingContextAttachment | null;
  isCapturing: boolean;
  error: string | null;
  capture: () => Promise<void>;
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingContextAttachment | null>(null);
  const mountedRef = useRef(true);

  const revokePending = useCallback((attachment: PendingContextAttachment | null) => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }, []);

  const clear = useCallback(() => {
    revokePending(pendingRef.current);
    pendingRef.current = null;
    setPending(null);
  }, [revokePending]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      revokePending(pendingRef.current);
      pendingRef.current = null;
    };
  }, [revokePending]);

  const capture = useCallback(async () => {
    setError(null);
    setIsCapturing(true);
    try {
      const snapshot = await captureDisplaySnapshot({
        startDisplayMedia: options?.startDisplayMedia,
      });
      if (!mountedRef.current) {
        return;
      }
      const next = snapshotToPending(snapshot);
      revokePending(pendingRef.current);
      pendingRef.current = next;
      setPending(next);
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
  }, [options?.startDisplayMedia, revokePending]);

  return {
    pending,
    isCapturing,
    error,
    capture,
    clear,
    clearError: () => setError(null),
  };
}
