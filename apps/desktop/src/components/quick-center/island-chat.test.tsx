import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "@linvo/shared";

import { IslandChat } from "@/components/quick-center/island-chat";
import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";
import * as chatApi from "@/lib/chat/chat-api";
import { writeClipboardText } from "@/lib/clipboard";
import { openPanel } from "@/lib/panel-window";

vi.mock("@/lib/chat/chat-api", () => ({
  createConversation: vi.fn(),
  listMessages: vi.fn(),
  streamChatResponse: vi.fn(),
  submitToolResult: vi.fn(),
  regenerateMessage: vi.fn(),
}));

vi.mock("@/lib/chat/chat-local-store", () => ({
  hydrateChatLocalStore: vi.fn(() => Promise.resolve()),
  loadCachedConversationMessagesFromStore: vi.fn(() => Promise.resolve([])),
  saveCachedConversationMessages: vi.fn(),
}));

vi.mock("@/lib/chat/chat-attachments-api", () => ({
  uploadChatAttachment: vi.fn(),
}));

vi.mock("@/lib/procedure/procedure-api", () => ({
  getProcedureBySlug: vi.fn(),
  createProcedureFromText: vi.fn(),
}));

vi.mock("@/lib/panel-window", () => ({
  openPanel: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/clipboard", () => ({
  writeClipboardText: vi.fn(() => Promise.resolve(true)),
  readClipboardText: vi.fn(() => Promise.resolve("")),
}));

vi.mock("@/lib/chat/llm-models", () => ({
  fetchLlmModels: vi.fn(() => Promise.resolve([])),
  loadSelectedModel: vi.fn((fallback: string) => fallback),
  saveSelectedModel: vi.fn(),
}));

vi.mock("@/lib/llm/llm-credential-api", () => ({
  fetchUserLlmStatus: vi.fn(() =>
    Promise.resolve({
      hasOwnKey: false,
      effectiveSource: "workspace",
      modelSelectionEnabled: false,
    }),
  ),
}));

function conversation(id: string): Conversation {
  return {
    id,
    title: "New conversation",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

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

describe("IslandChat", () => {
  const scope = { userId: "user-1", workspaceId: "ws-1" };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("linvo.activeWorkspaceId", scope.workspaceId);
    vi.clearAllMocks();
    vi.mocked(chatApi.listMessages).mockResolvedValue([]);
    URL.createObjectURL = vi.fn(() => "blob:optimistic");
  });

  it("T2.1 envia oi, cria conversa e concatena os chunks", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "olá ";
        yield "mundo";
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    const textbox = await screen.findByPlaceholderText(
      "Pergunte qualquer coisa...",
    );
    await user.type(textbox, "oi{Enter}");

    await waitFor(() => {
      expect(chatApi.createConversation).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("olá mundo")).toBeInTheDocument();
    expect(screen.getByText("oi")).toBeInTheDocument();
  });

  it("T2.2 send na ilha não chama openPanel", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "resposta";
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    await screen.findByText("resposta");
    expect(openPanel).not.toHaveBeenCalled();
  });

  it("T2.3 id salvo hidrata via listMessages e não cria conversa", async () => {
    saveActiveConversationId("conv-saved", scope);
    vi.mocked(chatApi.listMessages).mockResolvedValue([
      {
        id: "m-user",
        role: "user",
        content: "pergunta cacheada",
        status: "done",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m-assistant",
        role: "assistant",
        content: "resposta cacheada",
        status: "done",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ]);

    render(<IslandChat userId={scope.userId} />);

    expect(await screen.findByText("pergunta cacheada")).toBeInTheDocument();
    expect(screen.getByText("resposta cacheada")).toBeInTheDocument();
    expect(chatApi.createConversation).not.toHaveBeenCalled();
    expect(chatApi.listMessages).toHaveBeenCalledWith("conv-saved");
  });

  it("preserva a conversa ativa no replay de efeitos do StrictMode", async () => {
    saveActiveConversationId("conv-saved", scope);

    render(
      <StrictMode>
        <IslandChat userId={scope.userId} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(chatApi.listMessages).toHaveBeenCalledWith("conv-saved");
    });
    expect(loadActiveConversationId(scope)).toBe("conv-saved");
  });

  it("KAN-33 continueRequest troca para a conversa pedida e persiste o id", async () => {
    saveActiveConversationId("conv-a", scope);
    vi.mocked(chatApi.listMessages).mockImplementation(async (id: string) => [
      {
        id: `${id}-user`,
        role: "user",
        content: `pergunta ${id}`,
        status: "done",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const rendered = render(
      <IslandChat userId={scope.userId} continueRequest={null} />,
    );
    expect(await screen.findByText("pergunta conv-a")).toBeInTheDocument();

    rendered.rerender(
      <IslandChat
        userId={scope.userId}
        continueRequest={{ conversationId: "conv-b", token: 1 }}
      />,
    );

    expect(await screen.findByText("pergunta conv-b")).toBeInTheDocument();
    expect(screen.queryByText("pergunta conv-a")).not.toBeInTheDocument();
    expect(loadActiveConversationId(scope)).toBe("conv-b");
    expect(chatApi.createConversation).not.toHaveBeenCalled();
  });

  it("KAN-33 continueRequest presente na montagem não refaz a carga", async () => {
    saveActiveConversationId("conv-a", scope);

    render(
      <IslandChat
        userId={scope.userId}
        continueRequest={{ conversationId: "conv-a", token: 3 }}
      />,
    );

    await waitFor(() => {
      expect(chatApi.listMessages).toHaveBeenCalledWith("conv-a");
    });
    expect(chatApi.listMessages).toHaveBeenCalledTimes(1);
  });

  it("T2.4 disabled não envia", async () => {
    const user = userEvent.setup();
    render(<IslandChat userId={scope.userId} disabled />);

    const textbox = await screen.findByPlaceholderText(
      "Pergunte qualquer coisa...",
    );
    expect(textbox).toBeDisabled();
    expect(screen.getByTitle("Enviar")).toBeDisabled();

    await user.click(screen.getByTitle("Enviar"));
    expect(chatApi.createConversation).not.toHaveBeenCalled();
    expect(chatApi.streamChatResponse).not.toHaveBeenCalled();
  });

  it("T2.5 a ilha tem textbox de chat", async () => {
    render(<IslandChat userId={scope.userId} />);

    expect(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox"),
    ).toBeInTheDocument();
  });

  it("T3.4 Parar visível no stream aborta o signal", async () => {
    const user = userEvent.setup();
    const gate = deferred<void>();
    const started = deferred<AbortSignal>();
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
        yield "parcial";
        await gate.promise;
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    const signal = await started.promise;
    const stop = await screen.findByRole("button", { name: "Parar" });
    await user.click(stop);

    expect(signal.aborted).toBe(true);
    expect(openPanel).not.toHaveBeenCalled();
    gate.resolve();
  });

  it("T4.1 última assistente done mostra Copiar", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "resposta final";
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    expect(await screen.findByRole("button", { name: "Copiar" })).toBeInTheDocument();
  });

  it("T4.2 click Copiar escreve o content e vira Copiado", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "resposta final";
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    await user.click(await screen.findByRole("button", { name: "Copiar" }));
    expect(writeClipboardText).toHaveBeenCalledWith("resposta final");
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });

  it("T4.3 Copiar não chama openPanel", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "resposta final";
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    await user.click(await screen.findByRole("button", { name: "Copiar" }));
    expect(openPanel).not.toHaveBeenCalled();
  });

  it("T4.4 durante o stream o CTA primário é Parar, não Copiar", async () => {
    const user = userEvent.setup();
    const gate = deferred<void>();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "parcial";
        await gate.promise;
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    expect(await screen.findByRole("button", { name: "Parar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar" })).not.toBeInTheDocument();
    gate.resolve();
  });

  it("T8.3 Copiar visível com done; clipboard é só o texto, sem bullets", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        yield "resposta final";
        options.onCaptureSummary?.(["pedido de cancelamento"]);
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    expect(await screen.findByRole("button", { name: "Copiar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeClipboardText).toHaveBeenCalledWith("resposta final");
    expect(writeClipboardText).not.toHaveBeenCalledWith(
      expect.stringContaining("pedido de cancelamento"),
    );
  });

  it("mostra chips de citação na bolha assistente", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation((options) =>
      (async function* () {
        options.onCitation?.({
          id: "d1",
          kind: "document",
          label: "Política comercial",
        });
        yield "com base";
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "política{Enter}",
    );

    expect(
      await screen.findByRole("button", { name: "Política comercial" }),
    ).toBeInTheDocument();
  });

  it("mostra Não encontrei na base quando citations é []", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
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

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "busca{Enter}",
    );

    expect(
      await screen.findByText("Não encontrei na base"),
    ).toBeInTheDocument();
  });

  it("não mostra fallback de citação quando o campo é omitido", async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-new"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "olá";
      })(),
    );

    render(<IslandChat userId={scope.userId} />);

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    expect(await screen.findByText("olá")).toBeInTheDocument();
    expect(screen.queryByText("Não encontrei na base")).not.toBeInTheDocument();
  });
});
