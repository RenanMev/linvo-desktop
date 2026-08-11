import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/chat/chat-panel";

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: function TestChatInput() {
    const [hasContext, setHasContext] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setHasContext(true)}>
          Adicionar contexto
        </button>
        {hasContext ? <span>Contexto pendente</span> : null}
      </div>
    );
  },
}));

vi.mock("@/components/chat/chat-message-list", () => ({
  ChatMessageList: () => null,
}));

vi.mock("@/components/chat/chat-toolbar", () => ({
  ChatToolbar: () => null,
}));

describe("ChatPanel", () => {
  it("discards pending composer context when switching conversations", async () => {
    const user = userEvent.setup();
    const props = {
      conversationTitle: "Conversa",
      messages: [],
      isResponding: false,
      replyTarget: null,
      onSend: vi.fn(),
      onReply: vi.fn(),
      onCancelReply: vi.fn(),
    };
    const rendered = render(
      <ChatPanel {...props} conversationKey="conv-1" />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar contexto" }));
    expect(screen.getByText("Contexto pendente")).toBeInTheDocument();

    rendered.rerender(<ChatPanel {...props} conversationKey="conv-2" />);

    expect(screen.queryByText("Contexto pendente")).not.toBeInTheDocument();
  });
});
