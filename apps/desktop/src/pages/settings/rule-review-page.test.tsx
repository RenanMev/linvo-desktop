import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RuleReviewPage } from "@/pages/settings/rule-review-page";

const mockWorkspace = {
  id: "ws-1",
  name: "Workspace Teste",
  role: "OWNER" as const,
  imageUrl: null,
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

const mockMemberWorkspace = {
  ...mockWorkspace,
  role: "MEMBER" as const,
};

const pendingCandidate = {
  id: "candidate-1",
  sessionId: "session-1",
  sourceDocumentId: "doc-1",
  category: "BUSINESS_RULE" as const,
  title: "Regra sugerida",
  content: "Conteúdo sugerido",
  confidence: 0.9,
  sourceExcerpt: "trecho",
  status: "PENDING" as const,
  promoteToRule: null,
  promoteToKnowledge: null,
  businessRuleId: null,
  knowledgeDocumentId: null,
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

const readySession = {
  id: "session-1",
  workspaceId: "ws-1",
  status: "READY" as const,
  error: null,
  documents: [
    {
      id: "doc-1",
      originalName: "manual.txt",
      mimeType: "text/plain",
      status: "EXTRACTED" as const,
      error: null,
      createdAt: "2026-07-20T20:00:00.000Z",
      updatedAt: "2026-07-20T20:00:00.000Z",
    },
  ],
  candidates: [pendingCandidate],
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

const processingSession = {
  ...readySession,
  status: "PROCESSING" as const,
  candidates: [],
};

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: vi.fn(),
}));

vi.mock("@/lib/workspace/rule-discovery-api", () => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  acceptCandidate: vi.fn(),
  rejectCandidate: vi.fn(),
}));

import { useWorkspace } from "@/context/workspace-context";
import * as ruleDiscoveryApi from "@/lib/workspace/rule-discovery-api";

function renderPage(workspaceId = "ws-1") {
  return render(
    <MemoryRouter initialEntries={[`/settings/workspace/${workspaceId}/rule-review`]}>
      <Routes>
        <Route
          path="/settings/workspace/:workspaceId/rule-review"
          element={<RuleReviewPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RuleReviewPage", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    vi.mocked(useWorkspace).mockReturnValue({
      workspaces: [mockWorkspace],
      activeWorkspace: mockWorkspace,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      selectWorkspace: vi.fn(),
      createWorkspace: vi.fn(),
      renameWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      uploadImage: vi.fn(),
      removeImage: vi.fn(),
    });
    vi.mocked(ruleDiscoveryApi.listSessions).mockResolvedValue([
      {
        id: "session-1",
        workspaceId: "ws-1",
        status: "READY",
        documentCount: 1,
        candidateCount: 1,
        createdAt: "2026-07-20T20:00:00.000Z",
        updatedAt: "2026-07-20T20:00:00.000Z",
      },
    ]);
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue(readySession);
    vi.mocked(ruleDiscoveryApi.createSession).mockResolvedValue(readySession);
    vi.mocked(ruleDiscoveryApi.acceptCandidate).mockResolvedValue({
      candidate: { ...pendingCandidate, status: "ACCEPTED" },
      businessRule: {
        id: "rule-1",
        workspaceId: "ws-1",
        title: "Regra sugerida",
        content: "Conteúdo sugerido",
        priority: 0,
        active: true,
        createdAt: "2026-07-20T20:00:00.000Z",
        updatedAt: "2026-07-20T20:00:00.000Z",
      },
    });
    vi.mocked(ruleDiscoveryApi.rejectCandidate).mockResolvedValue({
      ...pendingCandidate,
      status: "REJECTED",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("blocks MEMBER from using rule review", async () => {
    vi.mocked(useWorkspace).mockReturnValue({
      workspaces: [mockMemberWorkspace],
      activeWorkspace: mockMemberWorkspace,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      selectWorkspace: vi.fn(),
      createWorkspace: vi.fn(),
      renameWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      uploadImage: vi.fn(),
      removeImage: vi.fn(),
    });

    renderPage();

    expect(
      await screen.findByText("Acesso restrito ao proprietário"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar arquivos" })).toBeNull();
  });

  it("shows upload and checklist for OWNER", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("button", { name: "Enviar arquivos" })).toBeInTheDocument();
    expect(await screen.findByText("Sessões recentes")).toBeInTheDocument();
    expect(ruleDiscoveryApi.listSessions).toHaveBeenCalledWith("ws-1");
    expect(await screen.findByText(/Pronta · 1 candidatos/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /candidatos/i }));

    expect(await screen.findByText("Checklist de candidatos")).toBeInTheDocument();
    expect(screen.getByLabelText("Título do candidato")).toHaveValue("Regra sugerida");
    expect(screen.getByRole("button", { name: "Aceitar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Negar" })).toBeInTheDocument();
  });

  it("requires at least one destination before accept", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /candidatos/i }));
    await user.click(await screen.findByRole("button", { name: "Aceitar" }));

    expect(
      await screen.findByText("Selecione ao menos um destino (regra ou knowledge)"),
    ).toBeInTheDocument();
    expect(ruleDiscoveryApi.acceptCandidate).not.toHaveBeenCalled();
  });

  it("accepts candidate when destination is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /candidatos/i }));
    await user.click(screen.getByLabelText("Promover para regra"));
    await user.click(screen.getByRole("button", { name: "Aceitar" }));

    await waitFor(() => {
      expect(ruleDiscoveryApi.acceptCandidate).toHaveBeenCalledWith(
        "ws-1",
        "session-1",
        "candidate-1",
        expect.objectContaining({ promoteToRule: true }),
      );
    });
  });

  it("schedules polling while session is processing", async () => {
    const intervalSpy = vi.spyOn(window, "setInterval");
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue(processingSession);

    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /candidatos/i }));

    await waitFor(() => {
      expect(screen.getByText("Atualizando...")).toBeInTheDocument();
    });

    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    intervalSpy.mockRestore();
  });
});
