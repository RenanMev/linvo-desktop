import { useSyncExternalStore } from "react";

import { AudioRecorder, AudioRecorderError } from "@/lib/voice/audio-recorder";
import { transcribeAudio } from "@/lib/voice/transcription-api";

/*
 * Push-to-talk (KAN-41): segurar → gravar → soltar → transcrever → texto.
 *
 * Um único controlador por janela, fora do React: o atalho global (BarApp),
 * o botão do microfone (composer) e o indicador da pílula falam todos com
 * ele. Sem always-on por desenho — só existe gravação entre um `start()` e
 * um `stop()` explícitos, e `stop()` encerra as trilhas do microfone.
 */
export type PushToTalkPhase = "idle" | "recording" | "transcribing";

export type PushToTalkState = {
  phase: PushToTalkPhase;
  error: string | null;
  /** Última transcrição entregue; útil para quem monta depois. */
  lastTranscript: string | null;
};

type TranscriptListener = (text: string) => void;
type StateListener = () => void;

/** Gravação mais curta que isso é um toque acidental — não vale transcrever. */
const MIN_RECORDING_MS = 300;

let state: PushToTalkState = { phase: "idle", error: null, lastTranscript: null };
let recorder: AudioRecorder | null = null;
const stateListeners = new Set<StateListener>();
const transcriptListeners = new Set<TranscriptListener>();

function setState(patch: Partial<PushToTalkState>): void {
  state = { ...state, ...patch };
  for (const listener of stateListeners) {
    listener();
  }
}

function getRecorder(): AudioRecorder {
  recorder ??= new AudioRecorder();
  return recorder;
}

function describeError(error: unknown): string {
  if (error instanceof AudioRecorderError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Não foi possível transcrever o áudio.";
}

export function getPushToTalkState(): PushToTalkState {
  return state;
}

export function subscribePushToTalk(listener: StateListener): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

/** Quem quer o texto (o composer) assina aqui. */
export function onPushToTalkTranscript(listener: TranscriptListener): () => void {
  transcriptListeners.add(listener);
  return () => {
    transcriptListeners.delete(listener);
  };
}

export async function startPushToTalk(): Promise<void> {
  if (state.phase !== "idle") {
    return;
  }
  setState({ error: null });
  try {
    await getRecorder().start();
    setState({ phase: "recording" });
  } catch (error) {
    setState({ phase: "idle", error: describeError(error) });
  }
}

export async function stopPushToTalk(): Promise<void> {
  if (state.phase !== "recording") {
    return;
  }
  setState({ phase: "transcribing" });
  try {
    const recording = await getRecorder().stop();
    if (recording.durationMs < MIN_RECORDING_MS || recording.blob.size === 0) {
      setState({ phase: "idle" });
      return;
    }
    const extension = recording.mimeType.includes("ogg")
      ? "ogg"
      : recording.mimeType.includes("mp4")
        ? "m4a"
        : "webm";
    const text = await transcribeAudio(recording.blob, `push-to-talk.${extension}`);
    setState({ phase: "idle", lastTranscript: text });
    if (text.trim()) {
      for (const listener of transcriptListeners) {
        listener(text);
      }
    }
  } catch (error) {
    setState({ phase: "idle", error: describeError(error) });
  }
}

export function cancelPushToTalk(): void {
  recorder?.discard();
  setState({ phase: "idle" });
}

export function clearPushToTalkError(): void {
  if (state.error) {
    setState({ error: null });
  }
}

export function usePushToTalkState(): PushToTalkState {
  return useSyncExternalStore(subscribePushToTalk, getPushToTalkState, getPushToTalkState);
}

/** Só para testes: volta ao estado inicial sem vazar gravação. */
export function resetPushToTalkForTests(): void {
  recorder?.discard();
  recorder = null;
  state = { phase: "idle", error: null, lastTranscript: null };
  stateListeners.clear();
  transcriptListeners.clear();
}
