import { act, renderHook, waitFor } from "@testing-library/react";
import type { Conversation, ToolRequest } from "@linvo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "@/hooks/use-chat";
import * as chatApi from "@/lib/chat/chat-api";
import * as attachmentApi from "@/lib/chat/chat-attachments-api";
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

vi.mock("@/lib/chat/chat-attachments-api", () => ({
  uploadChatAttachment: vi.fn(),
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
    URL.createObjectURL = vi.fn(() => "blob:optimistic");
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
      expect(result.current.isLoadingHistory).toBe(false);
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

  it("uploads an attachment before sending its id to the stream", async () => {
    const onAccepted = vi.fn();
    const file = new File(["image"], "context.png", { type: "image/png" });
    vi.mocked(attachmentApi.uploadChatAttachment).mockResolvedValue({
      id: "att-1",
      kind: "image",
      mimeType: "image/png",
      filename: "context.png",
      sizeBytes: file.size,
      width: 800,
      height: 600,
    });
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        expect(options.attachmentIds).toEqual(["att-1"]);
        expect(options.content).toBe("");
        yield "imagem analisada";
      })(),
    );
    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );
    await waitFor(() => {
      expect(chatApi.listMessages).toHaveBeenCalledWith("conv-a");
      expect(result.current.isLoadingHistory).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage("", {
        attachment: {
          file,
          width: 800,
          height: 600,
          previewUrl: "blob:composer",
        },
        onAccepted,
      });
    });

    expect(attachmentApi.uploadChatAttachment).toHaveBeenCalledWith(
      "conv-a",
      file,
      {
        filename: "context.png",
        source: "display_capture",
      },
    );
    expect(onAccepted).toHaveBeenCalledOnce();
    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: "",
          attachments: [
            expect.objectContaining({
              id: "att-1",
              url: "blob:optimistic",
            }),
          ],
        }),
        expect.objectContaining({
          role: "assistant",
          content: "imagem analisada",
          status: "done",
        }),
      ]),
    );
  });

  it("keeps the composer unaccepted when attachment upload fails", async () => {
    const onAccepted = vi.fn();
    const file = new File(["image"], "context.png", { type: "image/png" });
    vi.mocked(attachmentApi.uploadChatAttachment).mockRejectedValue(
      new Error("upload falhou"),
    );
    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );
    await waitFor(() => {
      expect(chatApi.listMessages).toHaveBeenCalledWith("conv-a");
    });

    await act(async () => {
      await result.current.sendMessage("analise", {
        attachment: {
          file,
          width: 800,
          height: 600,
          previewUrl: "blob:composer",
        },
        onAccepted,
      });
    });

    expect(onAccepted).not.toHaveBeenCalled();
    expect(chatApi.streamChatResponse).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBe("upload falhou");
    expect(result.current.isResponding).toBe(false);
  });

  it("T3.1 stopResponding aborta o signal e preserva o texto parcial", async () => {
    const gate = deferred<void>();
    const started = deferred<AbortSignal>();

    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        const signal = options.signal;
        if (!signal) {
          throw new Error("expected AbortSignal");
        }
        started.resolve(signal);
        yield "parcial";
        await gate.promise;
        yield " extra";
      })(),
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );

    await waitFor(() => {
      expect(chatApi.listMessages).toHaveBeenCalledWith("conv-a");
      expect(result.current.isLoadingHistory).toBe(false);
    });

    act(() => {
      void result.current.sendMessage("hello");
    });

    const signal = await started.promise;
    await waitFor(() => {
      expect(result.current.isResponding).toBe(true);
      expect(result.current.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: "parcial",
          }),
        ]),
      );
    });

    act(() => {
      result.current.stopResponding();
    });

    expect(signal.aborted).toBe(true);
    expect(result.current.isResponding).toBe(false);
    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "parcial",
        }),
      ]),
    );

    await act(async () => {
      gate.resolve();
    });
  });

  it("accumulates citation chips on the assistant from stream events", async () => {
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        options.onCitation?.({
          id: "d1",
          kind: "document",
          label: "Política comercial",
        });
        options.onCitation?.({
          id: "p1",
          kind: "procedure",
          label: "Cancelar plano",
        });
        yield "com base";
      })(),
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );

    await waitFor(() => {
      expect(chatApi.listMessages).toHaveBeenCalledWith("conv-a");
      expect(result.current.isLoadingHistory).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage("onde está a política?");
    });

    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "com base",
          citations: [
            { id: "d1", kind: "document", label: "Política comercial" },
            { id: "p1", kind: "procedure", label: "Cancelar plano" },
          ],
        }),
      ]),
    );
  });

  it("keeps citations: [] from assistant done as a search miss", async () => {
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        yield "sem hits";
        options.onAssistantDone?.({
          id: "asst-1",
          role: "assistant",
          content: "sem hits",
          status: "done",
          createdAt: "2026-01-01T00:00:00.000Z",
          citations: [],
        });
      })(),
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage("busca isso");
    });

    const assistant = result.current.messages.find(
      (message) => message.role === "assistant",
    );
    expect(assistant?.citations).toEqual([]);
    expect(assistant?.citations).not.toBeUndefined();
  });

  it("does not drop stream citations when done omits the field", async () => {
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        options.onCitation?.({
          id: "d1",
          kind: "document",
          label: "Política comercial",
        });
        yield "com fonte";
        options.onAssistantDone?.({
          id: "asst-1",
          role: "assistant",
          content: "com fonte",
          status: "done",
          createdAt: "2026-01-01T00:00:00.000Z",
        });
      })(),
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage("com fonte?");
    });

    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          citations: [
            { id: "d1", kind: "document", label: "Política comercial" },
          ],
        }),
      ]),
    );
  });

  it("applies captureSummary without delaying assistant text", async () => {
    const gate = deferred<void>();
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        yield "vi o print";
        await gate.promise;
        options.onCaptureSummary?.(["pedido de cancelamento"]);
        yield " e segue";
      })(),
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
    });

    act(() => {
      void result.current.sendMessage("analise o print");
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: "vi o print",
          }),
        ]),
      );
    });
    expect(
      result.current.messages.find((message) => message.role === "assistant")
        ?.captureSummary,
    ).toBeUndefined();

    await act(async () => {
      gate.resolve();
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: "vi o print e segue",
            captureSummary: ["pedido de cancelamento"],
            status: "done",
          }),
        ]),
      );
    });
  });

  it("hydrates citations: [] from listMessages without collapsing", async () => {
    vi.mocked(chatApi.listMessages).mockResolvedValue([
      {
        id: "asst-hist",
        role: "assistant",
        content: "Sem hits",
        status: "done",
        createdAt: "2026-01-01T00:00:00.000Z",
        citations: [],
      },
    ]);

    const { result } = renderHook(() =>
      useChat({ conversationId: "conv-a" }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
      expect(result.current.messages).toEqual([
        expect.objectContaining({
          id: "asst-hist",
          citations: [],
        }),
      ]);
    });
    expect(result.current.messages[0]?.citations).not.toBeUndefined();
  });
});

