import { act, renderHook, waitFor } from "@testing-library/react";
import type { Conversation, ToolRequest } from "@linvo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "@/hooks/use-chat";
import * as chatApi from "@/lib/chat/chat-api";
import * as chatStore from "@/lib/chat/chat-local-store";
import type { ChatMessage } from "@/lib/chat/types";

vi.mock("@/lib/chat/chat-api", () => ({
  createConversation: vi.fn(),
  listMessages: vi.fn(),
  streamChatResponse: vi.fn(),
  submitToolResult: vi.fn(),
  regenerateMessage: vi.fn(),
}));

vi.mock("@/lib/chat/chat-local-store", () => ({
  hydrateChatLocalStore: vi.fn(),
  loadCachedConversationMessagesFromStore: vi.fn(),
  saveCachedConversationMessages: vi.fn(),
}));

vi.mock("@/lib/procedure/procedure-api", () => ({
  getProcedureBySlug: vi.fn(),
  createProcedureFromText: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function conversation(id: string): Conversation {
  return {
    id,
    title: "New conversation",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function cachedMessage(id: string, content: string): ChatMessage {
  return {
    id,
    role: "assistant",
    content,
    status: "done",
    createdAt: 1,
  };
}

describe("useChat stream ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatStore.hydrateChatLocalStore).mockResolvedValue();
    vi.mocked(
      chatStore.loadCachedConversationMessagesFromStore,
    ).mockResolvedValue([]);
    vi.mocked(chatApi.listMessages).mockResolvedValue([]);
  });

  it("keeps the first stream alive when the new conversation route is applied", async () => {
    const gate = deferred<void>();
    const started = deferred<AbortSignal>();
    const onConversationCreated = vi.fn();

    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        const signal = options.signal;
        if (!signal) {
          throw new Error("expected AbortSignal");
        }
        started.resolve(signal);
        await gate.promise;
        yield "assistant answer";
      })(),
    );

    const initialProps: { conversationId: string | null } = {
      conversationId: null,
    };
    const { result, rerender } = renderHook(
      ({ conversationId }: { conversationId: string | null }) =>
        useChat({ conversationId, onConversationCreated }),
      { initialProps },
    );

    let sending!: Promise<void>;
    act(() => {
      sending = result.current.sendMessage("hello");
    });

    await waitFor(() => {
      expect(onConversationCreated).toHaveBeenCalledWith("conv-new");
    });
    const signal = await started.promise;

    rerender({ conversationId: "conv-new" });

    expect(signal.aborted).toBe(false);
    expect(chatApi.listMessages).not.toHaveBeenCalledWith("conv-new");

    await act(async () => {
      gate.resolve();
      await sending;
    });

    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "hello" }),
        expect.objectContaining({
          role: "assistant",
          content: "assistant answer",
          status: "done",
        }),
      ]),
    );
  });

  it("does not accept a draft when creating the conversation fails", async () => {
    const onAccepted = vi.fn();
    vi.mocked(chatApi.createConversation).mockRejectedValue(
      new Error("offline"),
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: null }),
    );

    await act(async () => {
      await result.current.sendMessage("preserve me", { onAccepted });
    });

    expect(onAccepted).not.toHaveBeenCalled();
    expect(chatApi.streamChatResponse).not.toHaveBeenCalled();
  });

  it("reports a missing workspace as a failed checklist open", async () => {
    const request: ToolRequest = {
      requestId: "request-1",
      name: "open_procedure",
      label: "Abrir procedimento",
      args: { slug: "cancelamento" },
      requiresApproval: false,
    };

    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        options.onToolRequest?.(request);
      })(),
    );
    vi.mocked(chatApi.submitToolResult).mockImplementation(() =>
      (async function* () {})(),
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a", workspaceId: null }),
    );

    await act(async () => {
      await result.current.sendMessage("abra o procedimento");
    });

    expect(chatApi.submitToolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        approved: true,
        result: expect.stringMatching(
          /^Falha ao abrir o checklist "cancelamento": workspace indisponível\./,
        ),
      }),
    );
  });

  it("does not persist the next conversation under an aborted conversation id", async () => {
    const started = deferred<AbortSignal>();
    const messageB = cachedMessage("message-b", "conversation B");

    vi.mocked(
      chatStore.loadCachedConversationMessagesFromStore,
    ).mockImplementation(async (id) => (id === "conv-b" ? [messageB] : []));
    vi.mocked(chatApi.listMessages).mockImplementation(async (id) => {
      if (id === "conv-b") {
        throw new Error("offline");
      }
      return [];
    });
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        const signal = options.signal;
        if (!signal) {
          throw new Error("expected AbortSignal");
        }
        started.resolve(signal);
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      })(),
    );

    const { result, rerender } = renderHook(
      ({ conversationId }: { conversationId: string | null }) =>
        useChat({ conversationId }),
      { initialProps: { conversationId: "conv-a" } },
    );

    await waitFor(() => {
      expect(chatApi.listMessages).toHaveBeenCalledWith("conv-a");
    });

    let sending!: Promise<void>;
    act(() => {
      sending = result.current.sendMessage("from A");
    });
    const signal = await started.promise;

    rerender({ conversationId: "conv-b" });

    await waitFor(() => {
      expect(signal.aborted).toBe(true);
      expect(result.current.messages).toEqual([messageB]);
    });
    await act(async () => {
      await sending;
    });

    const pollutedCacheWrite = vi
      .mocked(chatStore.saveCachedConversationMessages)
      .mock.calls.some(
        ([id, messages]) =>
          id === "conv-a" &&
          messages.some((message) => message.id === "message-b"),
      );
    expect(pollutedCacheWrite).toBe(false);
    expect(result.current.messages).toEqual([messageB]);
  });
});

