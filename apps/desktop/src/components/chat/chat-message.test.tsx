import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatMessageBubble } from "@/components/chat/chat-message";
import type { ChatMessage } from "@/lib/chat/types";

const baseMessage: ChatMessage = {
  id: "m1",
  role: "assistant",
  content: "Olá!",
  createdAt: 100,
  status: "done",
};

describe("ChatMessageBubble", () => {
  it("renders assistant message content", () => {
    render(<ChatMessageBubble message={baseMessage} onReply={vi.fn()} />);

    expect(screen.getByText("Olá!")).toBeInTheDocument();
  });

  it("renders user message content", () => {
    const message: ChatMessage = {
      ...baseMessage,
      role: "user",
      content: "Pergunta",
    };

    render(<ChatMessageBubble message={message} onReply={vi.fn()} />);

    expect(screen.getByText("Pergunta")).toBeInTheDocument();
  });

  it("shows reasoning panel for empty streaming message", () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: "",
      status: "streaming",
    };

    const { container } = render(
      <ChatMessageBubble message={message} onReply={vi.fn()} />,
    );

    expect(container.textContent).toMatch(/Analisando|Pensando/);
  });

  it("renders markdown for assistant content", () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: "**negrito** e `codigo`",
    };

    render(<ChatMessageBubble message={message} onReply={vi.fn()} />);

    expect(screen.getByText("negrito")).toBeInTheDocument();
    expect(screen.getByText("codigo")).toBeInTheDocument();
  });

  it("shows skills inside reasoning panel when toolUses exist", () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: "Resposta com base",
      toolUses: [{ name: "search_knowledge", label: "Base de conhecimento" }],
    };

    render(<ChatMessageBubble message={message} onReply={vi.fn()} />);

    expect(screen.getByText(/1 skill/)).toBeInTheDocument();
  });

  it("shows error message when status is error", () => {
    const message: ChatMessage = {
      ...baseMessage,
      status: "error",
    };

    render(<ChatMessageBubble message={message} onReply={vi.fn()} />);

    expect(screen.getByText("Falha ao gerar resposta.")).toBeInTheDocument();
  });
});
