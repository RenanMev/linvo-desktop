import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatConversationsProvider, useConversations } from "@/context/chat-conversations-context";
import * as chatApi from "@/lib/chat/chat-api";
import { ChatApiError } from "@/lib/chat/chat-api";
import {
  loadCachedConversationMessages,
  resetChatLocalStoreForTests,
  saveCachedConversationMessages,
  saveCachedConversations,
} from "@/lib/chat/chat-local-store";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function DeleteButton({ id }: { id: string }) {
  const { conversations, deleteConversation, error } = useConversations();
  return (
    <div>
      <ul>
        {conversations.map((conversation) => (
          <li key={conversation.id}>{conversation.title}</li>
        ))}
      </ul>
      {error ? <p>{error}</p> : null}
      <button type="button" onClick={() => void deleteConversation(id)}>
        Apagar
      </button>
    </div>
  );
}

describe("ChatConversationsProvider deleteConversation", () => {
  beforeEach(() => {
    localStorage.clear();
    resetChatLocalStoreForTests();
    vi.restoreAllMocks();
    vi.spyOn(chatApi, "listConversations").mockResolvedValue([
      {
        id: "conv-1",
        title: "Conversa A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "conv-2",
        title: "Conversa B",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("removes conversation from list and clears message cache after API success", async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, "deleteConversation").mockResolvedValue();
    saveCachedConversations([
      {
        id: "conv-1",
        title: "Conversa A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    saveCachedConversationMessages("conv-1", [
      {
        id: "m1",
        role: "user",
        content: "Oi",
        createdAt: 1,
        status: "done",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/chat/conv-2"]}>
        <ChatConversationsProvider>
          <DeleteButton id="conv-1" />
        </ChatConversationsProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Conversa A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Apagar" }));

    await waitFor(() => {
      expect(screen.queryByText("Conversa A")).not.toBeInTheDocument();
    });
    expect(loadCachedConversationMessages("conv-1")).toEqual([]);
    expect(chatApi.deleteConversation).toHaveBeenCalledWith("conv-1");
  });

  it("navigates to /chat when deleting the active conversation", async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, "deleteConversation").mockResolvedValue();

    render(
      <MemoryRouter initialEntries={["/chat/conv-1"]}>
        <ChatConversationsProvider>
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={
                <>
                  <DeleteButton id="conv-1" />
                  <LocationProbe />
                </>
              }
            />
            <Route
              path="/chat"
              element={
                <>
                  <div>Chat vazio</div>
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </ChatConversationsProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Conversa A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Apagar" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/chat");
    });
  });

  it("treats 404 as success and still removes local conversation", async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, "deleteConversation").mockRejectedValue(
      new ChatApiError("conversa não encontrada", 404),
    );

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <ChatConversationsProvider>
          <DeleteButton id="conv-1" />
        </ChatConversationsProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Conversa A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Apagar" }));

    await waitFor(() => {
      expect(screen.queryByText("Conversa A")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Não foi possível apagar a conversa")).not.toBeInTheDocument();
  });

  it("keeps conversation and shows error when delete fails with non-404", async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, "deleteConversation").mockRejectedValue(
      new ChatApiError("falha", 500),
    );

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <ChatConversationsProvider>
          <DeleteButton id="conv-1" />
        </ChatConversationsProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Conversa A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Apagar" }));

    await waitFor(() => {
      expect(screen.getByText("Não foi possível apagar a conversa")).toBeInTheDocument();
    });
    expect(screen.getByText("Conversa A")).toBeInTheDocument();
  });
});
