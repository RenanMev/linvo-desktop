import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatInput, type ChatSendOptions } from "@/components/chat/chat-input";

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

vi.mock("@/lib/chat/llm-models", () => ({
  fetchLlmModels: vi.fn(() => new Promise(() => undefined)),
  loadSelectedModel: vi.fn((fallback: string) => fallback),
  saveSelectedModel: vi.fn(),
}));

import { resetPushToTalkForTests } from "@/lib/voice/push-to-talk";

function renderInput(onSend = vi.fn()) {
  render(
    <ChatInput
      onSend={onSend}
      isResponding={false}
      replyTarget={null}
      onCancelReply={vi.fn()}
    />,
  );
  return onSend;
}

describe("ChatInput voz (KAN-41/43)", () => {
  beforeEach(() => {
    resetPushToTalkForTests();
    vi.clearAllMocks();
    mocks.start.mockResolvedValue(undefined);
    mocks.stop.mockResolvedValue({
      blob: new Blob([new Uint8Array(2000)], { type: "audio/webm" }),
      mimeType: "audio/webm;codecs=opus",
      durationMs: 1800,
    });
    mocks.transcribeAudio.mockResolvedValue("cliente quer segunda via");
  });

  it("segurar o microfone grava, soltar transcreve e o texto entra no composer sem enviar", async () => {
    const onSend = renderInput();
    const mic = screen.getByRole("button", { name: "Segure para falar" });

    fireEvent.pointerDown(mic);
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent(/Ouvindo/);
    expect(screen.getByRole("button", { name: "Ouvindo" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.pointerUp(screen.getByRole("button", { name: "Ouvindo" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Pergunte qualquer coisa...")).toHaveValue(
        "cliente quer segunda via",
      ),
    );
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("transcrição concatena com o que já estava escrito", async () => {
    const user = userEvent.setup();
    renderInput();
    const textarea = screen.getByPlaceholderText("Pergunte qualquer coisa...");
    await user.type(textarea, "Olá,");

    const mic = screen.getByRole("button", { name: "Segure para falar" });
    fireEvent.pointerDown(mic);
    await waitFor(() => expect(mocks.start).toHaveBeenCalled());
    fireEvent.pointerUp(screen.getByRole("button", { name: "Ouvindo" }));

    await waitFor(() =>
      expect(textarea).toHaveValue("Olá, cliente quer segunda via"),
    );
  });

  it("falha do microfone aparece na ilha", async () => {
    mocks.start.mockRejectedValue(
      Object.assign(new Error("Permissão de microfone negada."), {
        name: "AudioRecorderError",
      }),
    );
    renderInput();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Segure para falar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Permissão de microfone negada.",
    );
  });

  it("anexo de áudio válido vira chip e vai no envio; inválido dá erro claro", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn((_content: string, options?: ChatSendOptions) => {
      options?.onAccepted?.();
    });
    renderInput(onSend);
    const input = screen.getByLabelText("Arquivo de áudio") as HTMLInputElement;

    // fireEvent: o `accept` do input filtraria o PDF no user.upload, e o
    // caso aqui é justamente um arquivo que passou pelo seletor do SO.
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(10)], "contrato.pdf", { type: "application/pdf" })],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/OGG, MP3 ou M4A/);

    const audio = new File([new Uint8Array(500)], "PTT-20260921-WA0007.ogg", {
      type: "audio/ogg",
    });
    fireEvent.change(input, { target: { files: [audio] } });
    expect(screen.getByText("PTT-20260921-WA0007.ogg")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Só o áudio, sem texto, já dá para enviar.
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onSend).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ audioAttachment: { file: audio } }),
    );
    await waitFor(() =>
      expect(screen.queryByText("PTT-20260921-WA0007.ogg")).not.toBeInTheDocument(),
    );
  });

  it("enableVoice=false mantém o clipe 'Em breve' e sem microfone", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        isResponding={false}
        replyTarget={null}
        onCancelReply={vi.fn()}
        enableVoice={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Segure para falar" })).toBeNull();
    expect(screen.queryByLabelText("Arquivo de áudio")).toBeNull();
    expect(screen.getByTitle("Em breve")).toBeDisabled();
  });
});
