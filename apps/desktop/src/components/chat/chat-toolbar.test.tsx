import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ChatToolbar } from "@/components/chat/chat-toolbar";

describe("ChatToolbar", () => {
  it("renders conversation title", () => {
    render(
      <MemoryRouter>
        <ChatToolbar title="Conversa de teste" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Conversa de teste")).toBeInTheDocument();
  });

  it("does not render a settings shortcut in the chat toolbar", () => {
    render(
      <MemoryRouter>
        <ChatToolbar title="Nova conversa" />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /configurações/i }),
    ).not.toBeInTheDocument();
  });
});
