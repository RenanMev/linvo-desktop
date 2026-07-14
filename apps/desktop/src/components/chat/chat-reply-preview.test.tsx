import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatReplyPreview } from "@/components/chat/chat-reply-preview";

describe("ChatReplyPreview", () => {
  it("shows reply author label", () => {
    render(
      <ChatReplyPreview
        replyTarget={{ id: "a1", role: "assistant", content: "resposta" }}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Respondendo Assistente")).toBeInTheDocument();
  });

  it("truncates long reply content", () => {
    const longContent = "a".repeat(120);

    render(
      <ChatReplyPreview
        replyTarget={{ id: "a1", role: "assistant", content: longContent }}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(`${"a".repeat(100)}…`)).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ChatReplyPreview
        replyTarget={{ id: "a1", role: "assistant", content: "resposta" }}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByTitle("Cancelar resposta"));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
