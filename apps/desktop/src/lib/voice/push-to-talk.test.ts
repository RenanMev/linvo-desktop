import { beforeEach, describe, expect, it, vi } from "vitest";

import { AudioRecorderError } from "@/lib/voice/audio-recorder";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  discard: vi.fn(),
  transcribeAudio: vi.fn(),
}));

vi.mock("@/lib/voice/audio-recorder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/voice/audio-recorder")>(
    "@/lib/voice/audio-recorder",
  );
  return {
    ...actual,
    AudioRecorder: class {
      start = mocks.start;
      stop = mocks.stop;
      discard = mocks.discard;
    },
  };
});

vi.mock("@/lib/voice/transcription-api", () => ({
  transcribeAudio: mocks.transcribeAudio,
}));

import {
  getPushToTalkState,
  onPushToTalkTranscript,
  resetPushToTalkForTests,
  startPushToTalk,
  stopPushToTalk,
  subscribePushToTalk,
} from "@/lib/voice/push-to-talk";

function recording(durationMs: number, size = 1200) {
  return {
    blob: new Blob([new Uint8Array(size)], { type: "audio/webm" }),
    mimeType: "audio/webm;codecs=opus",
    durationMs,
  };
}

describe("push-to-talk", () => {
  beforeEach(() => {
    resetPushToTalkForTests();
    vi.clearAllMocks();
    mocks.start.mockResolvedValue(undefined);
    mocks.stop.mockResolvedValue(recording(1500));
    mocks.transcribeAudio.mockResolvedValue("quero cancelar o pedido");
  });

  it("segurar grava, soltar transcreve e entrega o texto a quem assinou", async () => {
    const onTranscript = vi.fn();
    const phases: string[] = [];
    onPushToTalkTranscript(onTranscript);
    subscribePushToTalk(() => phases.push(getPushToTalkState().phase));

    await startPushToTalk();
    expect(getPushToTalkState().phase).toBe("recording");

    await stopPushToTalk();

    expect(mocks.transcribeAudio).toHaveBeenCalledWith(
      expect.any(Blob),
      "push-to-talk.webm",
    );
    expect(onTranscript).toHaveBeenCalledWith("quero cancelar o pedido");
    expect(getPushToTalkState()).toEqual({
      phase: "idle",
      error: null,
      lastTranscript: "quero cancelar o pedido",
    });
    expect(phases).toContain("transcribing");
  });

  it("toque acidental (< 300ms) não transcreve", async () => {
    mocks.stop.mockResolvedValue(recording(120));
    const onTranscript = vi.fn();
    onPushToTalkTranscript(onTranscript);

    await startPushToTalk();
    await stopPushToTalk();

    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
    expect(getPushToTalkState().phase).toBe("idle");
  });

  it("permissão negada vira erro visível e volta para idle", async () => {
    mocks.start.mockRejectedValue(
      new AudioRecorderError("Permissão de microfone negada.", "permission-denied"),
    );

    await startPushToTalk();

    expect(getPushToTalkState()).toMatchObject({
      phase: "idle",
      error: "Permissão de microfone negada.",
    });
  });

  it("falha na transcrição mantém o erro, sem texto", async () => {
    mocks.transcribeAudio.mockRejectedValue(new Error("não foi possível transcrever o áudio"));
    const onTranscript = vi.fn();
    onPushToTalkTranscript(onTranscript);

    await startPushToTalk();
    await stopPushToTalk();

    expect(onTranscript).not.toHaveBeenCalled();
    expect(getPushToTalkState()).toMatchObject({
      phase: "idle",
      error: "não foi possível transcrever o áudio",
    });
  });

  it("soltar sem ter segurado e segurar duas vezes são no-ops", async () => {
    await stopPushToTalk();
    expect(mocks.stop).not.toHaveBeenCalled();

    await startPushToTalk();
    await startPushToTalk();
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });
});
