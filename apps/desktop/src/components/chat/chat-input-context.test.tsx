import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ChatInput,
  type ChatSendOptions,
} from "@/components/chat/chat-input";
import type { DisplaySnapshotController } from "@/hooks/use-display-snapshot";

const useDisplaySnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-display-snapshot", () => ({
  useDisplaySnapshot: useDisplaySnapshotMock,
}));

vi.mock("@/lib/chat/llm-models", () => ({
  fetchLlmModels: vi.fn(() => new Promise(() => undefined)),
  loadSelectedModel: vi.fn((fallback: string) => fallback),
  saveSelectedModel: vi.fn(),
}));

describe("ChatInput visual context", () => {
  const capture = vi.fn();
  const clear = vi.fn();
  const clearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useDisplaySnapshotMock.mockReturnValue(
      controller({
        pending: null,
      }),
    );
  });

  it("starts capture from the dedicated button", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.click(
      screen.getByRole("button", { name: "Selecionar contexto" }),
    );

    expect(capture).toHaveBeenCalledOnce();
  });

  it("shows the preview and enables attachment-only send", async () => {
    const user = userEvent.setup();
    const file = new File(["image"], "context.png", { type: "image/png" });
    useDisplaySnapshotMock.mockReturnValue(
      controller({
        pending: {
          localId: "local-1",
          file,
          previewUrl: "blob:preview",
          width: 800,
          height: 600,
          sourceLabel: "Browser",
          status: "ready",
        },
      }),
    );
    const onSend = vi.fn(
      (_content: string, options?: ChatSendOptions) => {
        options?.onAccepted?.();
      },
    );
    renderInput(onSend);

    expect(screen.getByText("Browser")).toBeInTheDocument();
    expect(screen.getByTitle("Enviar")).toBeEnabled();
    await user.click(screen.getByTitle("Enviar"));

    expect(onSend).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        attachment: {
          file,
          width: 800,
          height: 600,
          previewUrl: "blob:preview",
          sourceLabel: "Browser",
        },
        onAccepted: expect.any(Function),
      }),
    );
    expect(clear).toHaveBeenCalledOnce();
  });

  it("removes a pending preview without sending", async () => {
    const user = userEvent.setup();
    useDisplaySnapshotMock.mockReturnValue(
      controller({
        pending: {
          localId: "local-1",
          file: new File(["image"], "context.png", { type: "image/png" }),
          previewUrl: "blob:preview",
          width: 800,
          height: 600,
          status: "ready",
        },
      }),
    );
    const onSend = vi.fn();
    renderInput(onSend);

    await user.click(screen.getByTitle("Remover contexto"));

    expect(clear).toHaveBeenCalledOnce();
    expect(clearError).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows capture errors and disables capture while busy", () => {
    useDisplaySnapshotMock.mockReturnValue(
      controller({
        isCapturing: true,
        error: "Não foi possível capturar a tela",
      }),
    );
    renderInput();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível capturar a tela",
    );
    expect(
      screen.getByRole("button", { name: "Selecionar contexto" }),
    ).toBeDisabled();
  });

  function renderInput(onSend = vi.fn()) {
    return render(
      <ChatInput
        onSend={onSend}
        isResponding={false}
        replyTarget={null}
        onCancelReply={vi.fn()}
      />,
    );
  }

  function controller(
    overrides: Partial<DisplaySnapshotController>,
  ): DisplaySnapshotController {
    return {
      pending: null,
      isCapturing: false,
      error: null,
      capture,
      clear,
      clearError,
      ...overrides,
    };
  }
});
