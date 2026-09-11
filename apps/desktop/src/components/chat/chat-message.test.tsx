import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMessageBubble } from "@/components/chat/chat-message";
import { writeClipboardText } from "@/lib/clipboard";
import type { ChatMessage } from "@/lib/chat/types";

vi.mock("@/lib/clipboard", () => ({
  writeClipboardText: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/panel-window", () => ({
  openPanel: vi.fn(() => Promise.resolve()),
}));

const baseMessage: ChatMessage = {
  id: "m1",
  role: "assistant",
  content: "Olá!",
  createdAt: 100,
  status: "done",
};

describe("ChatMessageBubble", () => {
  beforeEach(() => {
    vi.mocked(writeClipboardText).mockClear();
  });

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

  it("renders user attachment image", () => {
    const message: ChatMessage = {
      ...baseMessage,
      role: "user",
      content: "o que é isso?",
      attachments: [
        {
          id: "att_1",
          kind: "image",
          mimeType: "image/png",
          filename: "context.png",
          sizeBytes: 10,
          url: "blob:http://localhost/fake",
        },
      ],
    };

    render(<ChatMessageBubble message={message} onReply={vi.fn()} />);

    expect(screen.getByAltText("context.png")).toBeInTheDocument();
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

  it("T8.3 Copiar visível com done sem captureSummary; clipboard é só o content", async () => {
    const user = userEvent.setup();
    render(
      <ChatMessageBubble
        message={{ ...baseMessage, content: "resposta final" }}
        onReply={vi.fn()}
        variant="assist"
        showAssistCopy
      />,
    );

    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.queryByText("Resumo do print")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copiar" }));

    expect(writeClipboardText).toHaveBeenCalledWith("resposta final");
  });

  it("T8.3 Copiar não inclui bullets do captureSummary", async () => {
    const user = userEvent.setup();
    render(
      <ChatMessageBubble
        message={{
          ...baseMessage,
          content: "resposta final",
          captureSummary: ["pedido de cancelamento", "protocolo 123"],
        }}
        onReply={vi.fn()}
        variant="assist"
        showAssistCopy
      />,
    );

    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar" }));

    expect(writeClipboardText).toHaveBeenCalledWith("resposta final");
    expect(writeClipboardText).not.toHaveBeenCalledWith(
      expect.stringContaining("pedido de cancelamento"),
    );
  });

  it("renders capture summary above assistant markdown", () => {
    render(
      <ChatMessageBubble
        message={{
          ...baseMessage,
          captureSummary: ["pedido de cancelamento"],
        }}
        onReply={vi.fn()}
      />,
    );

    const summary = screen.getByText("Resumo do print");
    const answer = screen.getByText("Olá!");
    expect(
      summary.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("pedido de cancelamento")).toBeInTheDocument();
  });

  it("does not render capture summary on the user bubble", () => {
    render(
      <ChatMessageBubble
        message={{
          ...baseMessage,
          role: "user",
          content: "segue o print",
          captureSummary: ["pedido de cancelamento"],
        }}
        onReply={vi.fn()}
      />,
    );

    expect(screen.queryByText("Resumo do print")).not.toBeInTheDocument();
    expect(screen.queryByText("pedido de cancelamento")).not.toBeInTheDocument();
  });

  it("renders citation chips on the assistant bubble", () => {
    render(
      <ChatMessageBubble
        message={{
          ...baseMessage,
          citations: [
            { id: "d1", kind: "document", label: "Política comercial" },
            { id: "p1", kind: "procedure", label: "Cancelar plano" },
          ],
        }}
        onReply={vi.fn()}
        workspaceId="ws-1"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Política comercial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar plano" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Não encontrei na base")).not.toBeInTheDocument();
  });

  it("shows search-miss fallback when citations is []", () => {
    render(
      <ChatMessageBubble
        message={{ ...baseMessage, citations: [] }}
        onReply={vi.fn()}
        workspaceId="ws-1"
      />,
    );

    expect(screen.getByText("Não encontrei na base")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Política comercial" }),
    ).not.toBeInTheDocument();
  });

  it("renders no citation UI when citations is omitted", () => {
    render(<ChatMessageBubble message={baseMessage} onReply={vi.fn()} />);

    expect(screen.queryByText("Não encontrei na base")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Política comercial" }),
    ).not.toBeInTheDocument();
  });
});
