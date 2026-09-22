import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PanelSidebar } from "@/components/panel/panel-sidebar";

const workspaceState = vi.hoisted(() => ({
  activeWorkspace: null as { id: string; name: string; imageUrl: null } | null,
}));

vi.mock("@/context/chat-conversations-context", () => ({
  useConversations: () => ({
    conversations: [
      {
        id: "conv-1",
        title: "Conversa A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    activeId: null,
    isLoading: false,
    error: null,
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    selectConversation: vi.fn(),
    syncActiveId: vi.fn(),
    refreshList: vi.fn(),
    updateConversationTitle: vi.fn(),
  }),
}));

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: () => ({
    workspaces: workspaceState.activeWorkspace
      ? [workspaceState.activeWorkspace]
      : [],
    activeWorkspace: workspaceState.activeWorkspace,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    applyRedeemedWorkspace: vi.fn(),
    selectWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PanelSidebar collapsed={false} />
    </MemoryRouter>,
  );
}

function topNav() {
  return within(screen.getByRole("navigation", { name: "Seções do painel" }));
}

describe("PanelSidebar nav (KAN-34)", () => {
  beforeEach(() => {
    workspaceState.activeWorkspace = { id: "ws-1", name: "Loja", imageUrl: null };
  });

  it("topo tem Histórico | Documentos | Procedimentos | Configurações, em ordem", () => {
    renderAt("/chat");

    const links = topNav().getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Histórico",
      "Documentos",
      "Procedimentos",
      "Configurações",
    ]);
    expect(topNav().getByRole("link", { name: "Procedimentos" })).toHaveAttribute(
      "href",
      "/settings/workspace/ws-1/procedures",
    );
  });

  it("em /chat/:id o Histórico está ativo e a lista de conversas aparece", () => {
    renderAt("/chat/conv-1");

    expect(topNav().getByRole("link", { name: "Histórico" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(screen.getByRole("navigation", { name: "Conversas" })).getByText(
        "Conversa A",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nova conversa")).not.toBeInTheDocument();
    expect(screen.queryByText("Voltar ao chat")).not.toBeInTheDocument();
  });

  it("em /settings/workspace só Configurações acende e os grupos de config aparecem", () => {
    renderAt("/settings/workspace");

    expect(
      topNav().getByRole("link", { name: "Configurações" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      topNav().getByRole("link", { name: "Procedimentos" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("navigation", { name: "Seções de configurações" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Conversas" }),
    ).not.toBeInTheDocument();
  });

  it("na rota de procedimentos só Procedimentos acende, não Configurações", () => {
    renderAt("/settings/workspace/ws-1/procedures");

    expect(
      topNav().getByRole("link", { name: "Procedimentos" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      topNav().getByRole("link", { name: "Configurações" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.queryByRole("navigation", { name: "Seções de configurações" }),
    ).not.toBeInTheDocument();
  });

  it("sem workspace ativo, Procedimentos fica desabilitado sem selo Em breve", () => {
    workspaceState.activeWorkspace = null;
    renderAt("/documents");

    expect(
      topNav().queryByRole("link", { name: "Procedimentos" }),
    ).not.toBeInTheDocument();
    const disabled = topNav().getByText("Procedimentos").closest("[aria-disabled]");
    expect(disabled).not.toBeNull();
    expect(within(disabled as HTMLElement).queryByText("Em breve")).toBeNull();
  });

  it("itens Em breve continuam visíveis em qualquer seção", () => {
    const { unmount } = renderAt("/documents");
    for (const label of ["Arquivadas", "Biblioteca", "Central de ajuda"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    unmount();

    renderAt("/settings/general");
    for (const label of ["Arquivadas", "Biblioteca", "Central de ajuda", "Atalhos", "Plano e uso"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Em breve").length).toBeGreaterThanOrEqual(5);
  });
});
