import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApiError } from "@/lib/auth/auth-api";
import * as chatApi from "@/lib/chat/chat-api";
import { ChatApiError } from "@/lib/chat/chat-api";
import { uploadChatAttachment } from "@/lib/chat/chat-attachments-api";
import { useQuickPrompt } from "@/hooks/use-quick-prompt";

vi.mock("@/lib/chat/chat-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/chat-api")>(
    "@/lib/chat/chat-api",
  );
  return {
    ...actual,
    createConversation: vi.fn(),
    streamChatResponse: vi.fn(),
  };
});

vi.mock("@/lib/chat/chat-attachments-api", () => ({
  uploadChatAttachment: vi.fn(),
}));

function makeConversation(id: string) {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    title: null,
  };
}

async function* toAsyncGenerator(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe("useQuickPrompt", () => {
  beforeEach(() => {
    vi.mocked(chatApi.createConversation).mockReset();
    vi.mocked(chatApi.streamChatResponse).mockReset();
    vi.mocked(uploadChatAttachment).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ignores empty or whitespace-only input", async () => {
    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await expect(result.current.send("   ")).resolves.toBe(false);
    });

    expect(chatApi.createConversation).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("creates a conversation, streams chunks and finishes done", async () => {
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation("conv-1") as any,
    );
    vi.mocked(chatApi.streamChatResponse).mockReturnValue(
      toAsyncGenerator(["Olá", ", ", "mundo"]),
    );

    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await expect(result.current.send("oi")).resolves.toBe(true);
    });

    expect(chatApi.createConversation).toHaveBeenCalledTimes(1);
    expect(result.current.conversationId).toBe("conv-1");
    expect(result.current.responseText).toBe("Olá, mundo");
    expect(result.current.status).toBe("done");
  });

  it("uploads the visual context and streams with its attachment id", async () => {
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation("conv-1") as any,
    );
    vi.mocked(uploadChatAttachment).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: "att-1" } as any,
    );
    vi.mocked(chatApi.streamChatResponse).mockReturnValue(
      toAsyncGenerator(["vejo um erro"]),
    );

    const file = new File(["image"], "context.png", { type: "image/png" });
    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await expect(
        result.current.send("", {
          attachment: { file, width: 800, height: 600, previewUrl: "blob:x" },
        }),
      ).resolves.toBe(true);
    });

    expect(uploadChatAttachment).toHaveBeenCalledWith("conv-1", file, {
      filename: "context.png",
      source: "display_capture",
    });
    expect(chatApi.streamChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({ content: "", attachmentIds: ["att-1"] }),
    );
    expect(result.current.responseText).toBe("vejo um erro");
  });

  it("reports an upload failure without streaming", async () => {
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation("conv-1") as any,
    );
    vi.mocked(uploadChatAttachment).mockRejectedValue(
      new ChatApiError("Anexo grande demais", 413),
    );

    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await expect(
        result.current.send("olha isso", {
          attachment: {
            file: new File(["image"], "context.png", { type: "image/png" }),
            width: 800,
            height: 600,
            previewUrl: "blob:x",
          },
        }),
      ).resolves.toBe(false);
    });

    expect(chatApi.streamChatResponse).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("Anexo grande demais");
  });

  it("reuses the same conversation across sends", async () => {
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation("conv-1") as any,
    );
    vi.mocked(chatApi.streamChatResponse).mockReturnValue(
      toAsyncGenerator(["ok"]),
    );

    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await result.current.send("primeira");
    });
    await act(async () => {
      await result.current.send("segunda");
    });

    expect(chatApi.createConversation).toHaveBeenCalledTimes(1);
  });

  it("stop() preserves partial text and aborts the stream", async () => {
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation("conv-1") as any,
    );

    let capturedSignal: AbortSignal | undefined;
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) => {
      capturedSignal = options.signal;
      return (async function* () {
        yield "parcial";
        await new Promise<void>((resolve) => {
          options.signal?.addEventListener("abort", () => resolve());
        });
        yield "tardio";
      })();
    });

    const { result } = renderHook(() => useQuickPrompt());

    let sendPromise!: Promise<boolean>;
    act(() => {
      sendPromise = result.current.send("teste");
    });

    await waitFor(() => expect(result.current.responseText).toBe("parcial"));

    act(() => {
      result.current.stop();
    });

    await act(async () => {
      await sendPromise;
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.responseText).toBe("parcial");
    expect(result.current.status).toBe("done");
  });

  it("sets error status and message on failure, keeping caller free to preserve input", async () => {
    vi.mocked(chatApi.createConversation).mockRejectedValue(
      new AuthApiError("Não autorizado", 401),
    );

    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await expect(result.current.send("oi")).resolves.toBe(false);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/painel/i);
  });

  it("surfaces ChatApiError message directly", async () => {
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation("conv-1") as any,
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() => {
      throw new ChatApiError("Falha no servidor", 500);
    });

    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await result.current.send("oi");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("Falha no servidor");
  });

  it("reset() clears state back to idle", async () => {
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation("conv-1") as any,
    );
    vi.mocked(chatApi.streamChatResponse).mockReturnValue(
      toAsyncGenerator(["ok"]),
    );

    const { result } = renderHook(() => useQuickPrompt());

    await act(async () => {
      await result.current.send("oi");
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.responseText).toBe("");
    expect(result.current.conversationId).toBeNull();
  });
});
