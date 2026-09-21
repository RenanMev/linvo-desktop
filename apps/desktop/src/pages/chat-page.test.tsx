import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";

import { ChatPage } from "@/pages/chat-page";

const mocks = vi.hoisted(() => ({
  continueInAssist: vi.fn(() => Promise.resolve()),
  openChecklist: vi.fn(() => Promise.resolve()),
  syncActiveId: vi.fn(),
  useChat: vi.fn(),
}));

vi.mock("@/lib/assist-handoff", () => ({
  continueInAssist: mocks.continueInAssist,
}));

vi.mock("@/lib/checklist-window", () => ({
  openChecklist: mocks.openChecklist,
  closeChecklist: vi.fn(() => Promise.resolve()),
  listenChecklistProgress: vi.fn(() => Promise.resolve(() => {})),
  listenChecklistClosed: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@/context/chat-conversations-context", () => ({
  useConversations: () => ({
    conversations: [
      {
        id: "conv-1",
        title: "Troca de produto",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
    error: null,
    syncActiveId: mocks.syncActiveId,
    updateConversationTitle: vi.fn(),
    refreshList: vi.fn(),
  }),
}));

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: () => ({
    activeWorkspace: { id: "ws-1", name: "Loja" },
  }),
}));

vi.mock("@/hooks/use-chat", () => ({
  useChat: mocks.useChat,
}));

vi.mock("@/components/chat/chat-message-list", () => ({
  ChatMessageList: ({
    messages,
    onReply,
    onRegenerate,
  }: {
    messages: Array<{ id: string; content: string }>;
    onReply?: unknown;
    onRegenerate?: unknown;
  }) => (
    <div>
      {messages.map((message) => (
        <p key={message.id}>{message.content}</p>
      ))}
      <span data-testid="reply-enabled">{String(Boolean(onReply))}</span>
      <span data-testid="regenerate-enabled">
        {String(Boolean(onRegenerate))}
      </span>
    </div>
  ),
}));

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: () => <textarea aria-label="Composer" />,
}));

const session = {
  user: {
    id: "user-1",
    name: "Renan",
    email: "renan@test.com",
    createdAt: "2026-01-01",
  },
  logout: vi.fn(),
};

function chatState(messages: Array<Record<string, unknown>>) {
  return {
    messages,
    isResponding: false,
    isLoadingHistory: false,
    replyTarget: null,
    error: null,
    pendingToolRequest: null,
    sendMessage: vi.fn(),
    regenerateMessage: vi.fn(),
    startReply: vi.fn(),
    cancelReply: vi.fn(),
    resolveToolRequest: vi.fn(),
    stopResponding: vi.fn(),
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Outlet context={{ session }} />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatPage (Histórico)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useChat.mockReturnValue(
      chatState([
        { id: "m1", role: "user", content: "oi", status: "done" },
        { id: "m2", role: "assistant", content: "olá", status: "done" },
      ]),
    );
  });

  it("/chat/:id é só leitura: mensagens sem composer, responder ou regenerar", () => {
    renderAt("/chat/conv-1");

    expect(screen.getByText("oi")).toBeInTheDocument();
    expect(screen.getByText("olá")).toBeInTheDocument();
    expect(screen.queryByLabelText("Composer")).not.toBeInTheDocument();
    expect(screen.getByTestId("reply-enabled")).toHaveTextContent("false");
    expect(screen.getByTestId("regenerate-enabled")).toHaveTextContent(
      "false",
    );
  });

  it("não liga a janela de checklist ao useChat", () => {
    renderAt("/chat/conv-1");

    const options = mocks.useChat.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(options.onOpenProcedureChecklist).toBeUndefined();
    expect(mocks.openChecklist).not.toHaveBeenCalled();
  });

  it("Continuar no Assist entrega a conversa para a ilha com o escopo", async () => {
    const user = userEvent.setup();
    renderAt("/chat/conv-1");

    await user.click(
      screen.getByRole("button", { name: "Continuar no Assist" }),
    );

    await waitFor(() => {
      expect(mocks.continueInAssist).toHaveBeenCalledWith("conv-1", {
        userId: "user-1",
        workspaceId: "ws-1",
      });
    });
  });

  it("/chat sem id mostra o vazio do Histórico, não um chat novo", () => {
    mocks.useChat.mockReturnValue(chatState([]));

    renderAt("/chat");

    expect(
      screen.getByRole("heading", { name: "Histórico" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Composer")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continuar no Assist" }),
    ).not.toBeInTheDocument();
  });
});
