import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatInput } from "@/components/chat/chat-input";

describe("ChatInput", () => {
  it("sends message on Enter", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <ChatInput
        onSend={onSend}
        isResponding={false}
        replyTarget={null}
        onCancelReply={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText("Pergunte qualquer coisa...");
    await user.type(textarea, "olá{Enter}");

    expect(onSend).toHaveBeenCalledWith("olá");
  });

  it("disables send button when input is empty", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        isResponding={false}
        replyTarget={null}
        onCancelReply={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Enviar")).toBeDisabled();
  });

  it("disables send button while responding", async () => {
    const user = userEvent.setup();

    render(
      <ChatInput
        onSend={vi.fn()}
        isResponding
        replyTarget={null}
        onCancelReply={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText("Pergunte qualquer coisa...");
    await user.type(textarea, "teste");

    expect(screen.getByTitle("Enviar")).toBeDisabled();
  });

  it("shows reply placeholder when replying", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        isResponding={false}
        replyTarget={{ id: "a1", role: "assistant", content: "resposta" }}
        onCancelReply={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText("Escreva sua resposta..."),
    ).toBeInTheDocument();
  });
});
