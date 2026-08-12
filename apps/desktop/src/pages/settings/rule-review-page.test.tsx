import { resolvePermissions } from "@linvo/shared";
import type { WorkspacePermission } from "@linvo/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RuleReviewPage } from "@/pages/settings/rule-review-page";

const mockWorkspace = {
  id: "ws-1",
  name: "Workspace Teste",
  role: "OWNER" as const,
  permissions: resolvePermissions("OWNER"),
  imageUrl: null,
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

const mockMemberWorkspace = {
  ...mockWorkspace,
  role: "MEMBER" as const,
  permissions: resolvePermissions("MEMBER"),
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
  promoteToRule: true,
  promoteToKnowledge: false,
  promotionSource: null,
  businessRuleId: null,
  knowledgeDocumentId: null,
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

const readySession = {
  id: "session-1",
  workspaceId: "ws-1",
  status: "READY" as const,
  approvalMode: "QUESTION" as const,
  confidenceThreshold: 0.75,
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
  events: [
    {
      id: "evt-1",
      sessionId: "session-1",
      seq: 1,
      type: "session_started" as const,
      message: "Análise iniciada",
      payload: null,
      createdAt: "2026-07-20T20:00:00.000Z",
    },
    {
      id: "evt-2",
      sessionId: "session-1",
      seq: 2,
      type: "candidate_found" as const,
      message: "Encontrei: Regra sugerida",
      payload: { candidateId: "candidate-1" },
      createdAt: "2026-07-20T20:00:01.000Z",
    },
  ],
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

const processingSession = {
  ...readySession,
  status: "PROCESSING" as const,
  candidates: [],
  events: [readySession.events[0]],
};

const acceptedCandidate = {
  ...pendingCandidate,
  status: "ACCEPTED" as const,
  promotionSource: "AUTO" as const,
  businessRuleId: "rule-1",
};

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: vi.fn(),
}));

vi.mock("@/lib/workspace/rule-discovery-api", () => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  cancelSession: vi.fn(),
  acceptCandidate: vi.fn(),
  rejectCandidate: vi.fn(),
  undoCandidate: vi.fn(),
}));

import { useWorkspace } from "@/context/workspace-context";
import * as ruleDiscoveryApi from "@/lib/workspace/rule-discovery-api";

function renderPage(workspaceId = "ws-1") {
  return render(
    <MemoryRouter
      initialEntries={[`/settings/workspace/${workspaceId}/rule-review`]}
    >
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
      can: (permission: WorkspacePermission) => mockWorkspace.permissions.includes(permission),
      refresh: vi.fn(),
      applyRedeemedWorkspace: vi.fn(),
      selectWorkspace: vi.fn(),
      createWorkspace: vi.fn(),
      renameWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      leaveWorkspace: vi.fn(),
      uploadImage: vi.fn(),
      removeImage: vi.fn(),
    });
    vi.mocked(ruleDiscoveryApi.listSessions).mockResolvedValue([
      {
        id: "session-1",
        workspaceId: "ws-1",
        status: "READY",
        approvalMode: "QUESTION",
        confidenceThreshold: 0.75,
        documentCount: 1,
        candidateCount: 1,
        createdAt: "2026-07-20T20:00:00.000Z",
        updatedAt: "2026-07-20T20:00:00.000Z",
      },
    ]);
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue(readySession);
    vi.mocked(ruleDiscoveryApi.createSession).mockResolvedValue(readySession);
    vi.mocked(ruleDiscoveryApi.updateSession).mockResolvedValue({
      ...readySession,
      approvalMode: "ALLOW",
    });
    vi.mocked(ruleDiscoveryApi.acceptCandidate).mockResolvedValue({
      candidate: {
        ...pendingCandidate,
        status: "ACCEPTED",
        promotionSource: "MANUAL",
      },
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
    vi.mocked(ruleDiscoveryApi.undoCandidate).mockResolvedValue({
      ...acceptedCandidate,
      status: "REJECTED",
      businessRuleId: null,
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
      can: (permission: WorkspacePermission) => mockWorkspace.permissions.includes(permission),
      refresh: vi.fn(),
      applyRedeemedWorkspace: vi.fn(),
      selectWorkspace: vi.fn(),
      createWorkspace: vi.fn(),
      renameWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      leaveWorkspace: vi.fn(),
      uploadImage: vi.fn(),
      removeImage: vi.fn(),
    });

    renderPage();

    expect(
      await screen.findByText("Acesso restrito ao proprietário"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Arraste arquivos/i }),
    ).toBeNull();
  });

  it("shows upload, controls and checklist for OWNER", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: /Arraste arquivos ou clique para enviar/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Modo de aprovação"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Sessões recentes")).toBeInTheDocument();
    expect(ruleDiscoveryApi.listSessions).toHaveBeenCalledWith("ws-1");

    await user.click(screen.getByRole("button", { name: /1 candidato/i }));

    expect(await screen.findByText("Raciocínio")).toBeInTheDocument();

    expect(
      await screen.findByText("Checklist de candidatos"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("manual.txt").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Título do candidato")).toHaveValue(
      "Regra sugerida",
    );
    expect(screen.getByLabelText("Promover para regra")).toBeChecked();
    expect(screen.getByRole("button", { name: "Aceitar" })).toBeInTheDocument();
  });

  it("accepts candidate using AI-suggested destination draft", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /1 candidato/i }),
    );
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

  it("undos accepted candidate", async () => {
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue({
      ...readySession,
      candidates: [acceptedCandidate],
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /1 candidato/i }),
    );
    await user.click(await screen.findByRole("button", { name: "Desfazer" }));

    await waitFor(() => {
      expect(ruleDiscoveryApi.undoCandidate).toHaveBeenCalledWith(
        "ws-1",
        "session-1",
        "candidate-1",
      );
    });
  });

  it("schedules polling while session is processing", async () => {
    const intervalSpy = vi.spyOn(window, "setInterval");
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue(processingSession);

    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: /1 candidato/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Analisando")).toBeInTheDocument();
    });

    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    intervalSpy.mockRestore();
  });

  it("cancels a processing session", async () => {
    vi.mocked(ruleDiscoveryApi.listSessions).mockResolvedValue([
      {
        id: "session-1",
        workspaceId: "ws-1",
        status: "PROCESSING",
        approvalMode: "QUESTION",
        confidenceThreshold: 0.75,
        documentCount: 3,
        candidateCount: 0,
        createdAt: "2026-07-20T20:00:00.000Z",
        updatedAt: "2026-07-20T20:00:00.000Z",
      },
    ]);
    vi.mocked(ruleDiscoveryApi.cancelSession).mockResolvedValue({
      ...processingSession,
      status: "CANCELLED",
      error: "cancelado pelo usuário",
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Encerrar análise" }),
    );

    await waitFor(() => {
      expect(ruleDiscoveryApi.cancelSession).toHaveBeenCalledWith(
        "ws-1",
        "session-1",
      );
    });
  });
});
