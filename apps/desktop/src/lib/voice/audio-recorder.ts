/*
 * Gravação de microfone para o push-to-talk.
 *
 * `getUserMedia` só é chamado ao começar a gravar — é o pedido explícito de
 * permissão (o WebView2 mostra o prompt do SO na primeira vez). Nada de
 * stream aberto em segundo plano: quando a gravação para, as trilhas são
 * encerradas e o indicador de microfone do sistema apaga.
 */
export type AudioRecording = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
};

export class AudioRecorderError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "permission-denied"
      | "no-microphone"
      | "unsupported"
      | "failed",
  ) {
    super(message);
    this.name = "AudioRecorderError";
  }
}

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  return PREFERRED_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

function mapGetUserMediaError(error: unknown): AudioRecorderError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new AudioRecorderError(
      "Permissão de microfone negada. Libere o microfone para o Linvo nas configurações do sistema.",
      "permission-denied",
    );
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return new AudioRecorderError(
      "Nenhum microfone encontrado.",
      "no-microphone",
    );
  }
  return new AudioRecorderError(
    "Não foi possível acessar o microfone.",
    "failed",
  );
}

export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  async start(): Promise<void> {
    if (this.isRecording) {
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      throw new AudioRecorderError(
        "Gravação de áudio não disponível neste ambiente.",
        "unsupported",
      );
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      throw mapGetUserMediaError(error);
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      throw new AudioRecorderError(
        "Não foi possível iniciar a gravação.",
        "failed",
      );
    }

    this.chunks = [];
    this.stream = stream;
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    recorder.start();
    this.startedAt = Date.now();
  }

  async stop(): Promise<AudioRecording> {
    const recorder = this.recorder;
    const stream = this.stream;
    if (!recorder || !stream) {
      throw new AudioRecorderError("Nenhuma gravação em andamento.", "failed");
    }

    const durationMs = Date.now() - this.startedAt;
    const mimeType = recorder.mimeType || "audio/webm";

    await new Promise<void>((resolve) => {
      if (recorder.state === "inactive") {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(this.chunks, { type: mimeType });
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    return { blob, mimeType, durationMs };
  }

  /** Descarta a gravação sem transcrever (cancelar, sessão caiu, etc.). */
  discard(): void {
    const recorder = this.recorder;
    const stream = this.stream;
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // já parado
      }
    }
    stream?.getTracks().forEach((track) => track.stop());
  }
}
