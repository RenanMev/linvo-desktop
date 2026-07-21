import { useCallback, useEffect, useRef, useState } from "react";

import {
  PROCEDURE_RECORD_MAX_MS,
  PROCEDURE_RECORD_WARN_MS,
  formatRecordingClock,
  recorderPhaseForElapsed,
  type ProcedureRecorderPhase,
} from "@/lib/procedure/procedure-recorder";

export type ProcedureRecorderController = {
  phase: ProcedureRecorderPhase;
  elapsedLabel: string;
  error: string | null;
  retainVideo: boolean;
  setRetainVideo: (value: boolean) => void;
  recordedBlob: Blob | null;
  start: () => Promise<void>;
  stop: () => void;
  discard: () => void;
  clearError: () => void;
};

type StartDisplayMedia = () => Promise<MediaStream>;

const defaultStartDisplayMedia: StartDisplayMedia = () =>
  navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });

export function useProcedureRecorder(
  options: {
    startDisplayMedia?: StartDisplayMedia;
    now?: () => number;
  } = {},
): ProcedureRecorderController {
  const startDisplayMedia = options.startDisplayMedia ?? defaultStartDisplayMedia;
  const now = options.now ?? (() => Date.now());

  const [phase, setPhase] = useState<ProcedureRecorderPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retainVideo, setRetainVideo] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const finishRecording = useCallback(() => {
    clearTick();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupStream();
      setPhase("awaiting_confirm");
    }
  }, [clearTick, cleanupStream]);

  const start = useCallback(async () => {
    setError(null);
    setRecordedBlob(null);
    chunksRef.current = [];

    try {
      const stream = await startDisplayMedia();
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        cleanupStream();
        mediaRecorderRef.current = null;
        setPhase("awaiting_confirm");
      };

      startedAtRef.current = now();
      setElapsedMs(0);
      setPhase("recording");
      recorder.start(1000);

      clearTick();
      tickRef.current = window.setInterval(() => {
        const startedAt = startedAtRef.current;
        if (startedAt === null) {
          return;
        }
        const elapsed = now() - startedAt;
        setElapsedMs(elapsed);
        const nextPhase = recorderPhaseForElapsed(elapsed);
        if (nextPhase === "near_limit") {
          setPhase("near_limit");
        }
        if (elapsed >= PROCEDURE_RECORD_MAX_MS) {
          finishRecording();
        }
      }, 250);
    } catch {
      cleanupStream();
      setError("Não foi possível iniciar a captura de tela/janela");
      setPhase("idle");
    }
  }, [clearTick, cleanupStream, finishRecording, now, startDisplayMedia]);

  const stop = useCallback(() => {
    if (phase !== "recording" && phase !== "near_limit") {
      return;
    }
    finishRecording();
  }, [finishRecording, phase]);

  const discard = useCallback(() => {
    clearTick();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
    setRecordedBlob(null);
    setElapsedMs(0);
    setRetainVideo(false);
    setPhase("idle");
  }, [clearTick, cleanupStream]);

  useEffect(() => {
    return () => {
      clearTick();
      cleanupStream();
    };
  }, [clearTick, cleanupStream]);

  return {
    phase,
    elapsedLabel: formatRecordingClock(elapsedMs),
    error,
    retainVideo,
    setRetainVideo,
    recordedBlob,
    start,
    stop,
    discard,
    clearError: () => setError(null),
  };
}

export { PROCEDURE_RECORD_MAX_MS, PROCEDURE_RECORD_WARN_MS };
