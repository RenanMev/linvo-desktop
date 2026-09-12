import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "@linvo/shared";

import { IslandPanel } from "@/components/quick-center/island-panel";
import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";
import * as chatApi from "@/lib/chat/chat-api";
import { openPanel } from "@/lib/panel-window";

vi.mock("@/hooks/use-quick-center-workspace", () => ({
  useQuickCenterWorkspace: () => ({ name: "Acme", isLoading: false }),
}));

vi.mock("@/lib/panel-window", () => ({
  openPanel: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/chat/chat-api", () => ({
  createConversation: vi.fn(),
  listMessages: vi.fn(() => Promise.resolve([])),
  streamChatResponse: vi.fn(() => (async function* () {})()),
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

function renderPanel(
  overrides: Partial<Parameters<typeof IslandPanel>[0]> = {},
) {
  return render(
    <IslandPanel
      userId="user-1"
      apiHealthy
      sessionWarning={null}
      ready
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

describe("IslandPanel", () => {
  const scope = { userId: "user-1", workspaceId: "ws-1" };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("linvo.activeWorkspaceId", scope.workspaceId);
    vi.clearAllMocks();
  });

  it("T2.6 aria-label do dialog é Chat ou Assist, nunca Quick Center", () => {
    renderPanel();

    const dialog = screen.getByRole("dialog");
    expect(["Chat", "Assist"]).toContain(dialog.getAttribute("aria-label"));
    expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Quick Center" }),
    ).not.toBeInTheDocument();
  });

  it("T2.7 Esc chama onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel({ onClose });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("T2.8 Abrir na janela grande com id salvo chama openPanel da conversa", async () => {
    const user = userEvent.setup();
    saveActiveConversationId("conv-42", scope);
    const onClose = vi.fn();
    renderPanel({ onClose });

    await user.click(
      screen.getByRole("button", { name: "Abrir na janela grande" }),
    );

    expect(openPanel).toHaveBeenCalledWith("/chat/conv-42");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("T5.1 botão Nova pergunta existe e não há lista de conversas", () => {
    renderPanel();

    expect(
      screen.getByRole("button", { name: "Nova pergunta" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("T5.2 Nova pergunta esvazia a lista e limpa o id ativo", async () => {
    const user = userEvent.setup();
    saveActiveConversationId("conv-saved", scope);
    vi.mocked(chatApi.listMessages).mockResolvedValue([
      {
        id: "m-user",
        role: "user",
        content: "pergunta antiga",
        status: "done",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m-assistant",
        role: "assistant",
        content: "resposta antiga",
        status: "done",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ]);

    renderPanel();

    expect(await screen.findByText("pergunta antiga")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova pergunta" }));

    await waitFor(() => {
      expect(screen.queryByText("pergunta antiga")).not.toBeInTheDocument();
      expect(loadActiveConversationId(scope)).toBeNull();
    });
  });

  it("T5.3 próximo send após Nova pergunta cria conversa de novo", async () => {
    const user = userEvent.setup();
    saveActiveConversationId("conv-saved", scope);
    vi.mocked(chatApi.listMessages).mockResolvedValue([
      {
        id: "m-user",
        role: "user",
        content: "pergunta antiga",
        status: "done",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(chatApi.createConversation).mockResolvedValue(
      conversation("conv-nova"),
    );
    vi.mocked(chatApi.streamChatResponse).mockImplementation(() =>
      (async function* () {
        yield "nova resposta";
      })(),
    );

    renderPanel();
    expect(await screen.findByText("pergunta antiga")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova pergunta" }));

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi de novo{Enter}",
    );

    await waitFor(() => {
      expect(chatApi.createConversation).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("nova resposta")).toBeInTheDocument();
  });

  it("T5.4 dialog se chama Assist", () => {
    renderPanel();
    expect(screen.getByRole("dialog", { name: "Assist" })).toBeInTheDocument();
  });

  it("T5.5 Quick Center não aparece como label", () => {
    renderPanel();
    expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
  });

  it("T5.6 Nova pergunta com stream ativo aborta o signal", async () => {
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

    renderPanel();

    await user.type(
      await screen.findByPlaceholderText("Pergunte qualquer coisa..."),
      "oi{Enter}",
    );

    const signal = await started.promise;
    await user.click(screen.getByRole("button", { name: "Nova pergunta" }));

    expect(signal.aborted).toBe(true);
    expect(openPanel).not.toHaveBeenCalled();
    gate.resolve();
  });
});
