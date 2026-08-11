import { resolvePermissions } from "@linvo/shared";
import type { WorkspacePermission } from "@linvo/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProcedurePage } from "@/pages/settings/procedure-page";

const mockWorkspace = {
  id: "ws-1",
  name: "Workspace Teste",
  role: "MEMBER" as const,
  permissions: resolvePermissions("MEMBER"),
  imageUrl: null,
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
};

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: vi.fn(),
}));

vi.mock("@/lib/procedure/procedure-api", () => ({
  listProcedures: vi.fn(),
  createProcedure: vi.fn(),
  updateProcedure: vi.fn(),
  publishProcedure: vi.fn(),
  rejectProcedure: vi.fn(),
  deleteProcedure: vi.fn(),
}));

vi.mock("@/hooks/use-procedure-recorder", () => ({
  useProcedureRecorder: vi.fn(),
}));

vi.mock("@/hooks/use-procedure-status-poll", () => ({
  useProcedureStatusPoll: vi.fn(),
}));

import { useWorkspace } from "@/context/workspace-context";
import { useProcedureRecorder } from "@/hooks/use-procedure-recorder";
import * as procedureApi from "@/lib/procedure/procedure-api";

function mockRecorder(
  overrides: Partial<ReturnType<typeof useProcedureRecorder>> = {},
) {
  vi.mocked(useProcedureRecorder).mockReturnValue({
    phase: "idle",
    elapsedLabel: "0:00",
    error: null,
    retainVideo: false,
    setRetainVideo: vi.fn(),
    recordedBlob: null,
    start: vi.fn(),
    stop: vi.fn(),
    discard: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/workspace/ws-1/procedures"]}>
      <Routes>
        <Route
          path="/settings/workspace/:workspaceId/procedures"
          element={<ProcedurePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProcedurePage list", () => {
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
      uploadImage: vi.fn(),
      removeImage: vi.fn(),
    });
    mockRecorder();
    vi.mocked(procedureApi.listProcedures).mockResolvedValue([]);
  });

  it("renders pending, failed and published sections", async () => {
    vi.mocked(procedureApi.listProcedures).mockResolvedValue([
      {
        id: "p-pending",
        workspaceId: "ws-1",
        status: "PENDING_REVIEW",
        title: "Número cancelado",
        slug: null,
        markdown: "## Título / tema\n\nx",
        steps: null,
        retainVideo: false,
        videoPath: null,
        error: null,
        attemptCount: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z",
      },
      {
        id: "p-failed",
        workspaceId: "ws-1",
        status: "FAILED",
        title: null,
        slug: null,
        markdown: null,
        steps: null,
        retainVideo: false,
        videoPath: null,
        error: "tentativa 3/3: falha",
        attemptCount: 3,
        createdAt: "2026-07-21T12:00:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z",
      },
      {
        id: "p-published",
        workspaceId: "ws-1",
        status: "PUBLISHED",
        title: "Fluxo publicado",
        slug: "fluxo_publicado",
        markdown: "## Título / tema\n\ny",
        steps: ["passo 1"],
        retainVideo: false,
        videoPath: null,
        error: null,
        attemptCount: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z",
      },
    ]);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Em revisão" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Falhou" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Publicados" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Número cancelado")).toBeInTheDocument();
    expect(screen.getByText("Fluxo publicado")).toBeInTheDocument();
    expect(screen.getByText(/Procedure p-failed/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(procedureApi.listProcedures).toHaveBeenCalledWith("ws-1", [
        "PENDING_REVIEW",
        "FAILED",
        "PUBLISHED",
      ]);
    });
  });

  it("opens selected procedure markdown from pending list", async () => {
    const user = userEvent.setup();
    vi.mocked(procedureApi.listProcedures).mockResolvedValue([
      {
        id: "p-pending",
        workspaceId: "ws-1",
        status: "PENDING_REVIEW",
        title: "Número cancelado",
        slug: null,
        markdown: "## Passos numerados\n\n1. Abrir",
        steps: null,
        retainVideo: false,
        videoPath: null,
        error: null,
        attemptCount: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z",
      },
    ]);

    renderPage();
    await user.click(await screen.findByText("Número cancelado"));
    expect(
      await screen.findByDisplayValue(/## Passos numerados/),
    ).toBeInTheDocument();
  });

  it("confirms upload with retainVideo from recorder", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["webm"], { type: "video/webm" });
    const setRetainVideo = vi.fn();
    const discard = vi.fn();
    mockRecorder({
      phase: "awaiting_confirm",
      recordedBlob: blob,
      retainVideo: true,
      setRetainVideo,
      discard,
    });
    vi.mocked(procedureApi.createProcedure).mockResolvedValue({
      id: "proc-new",
      workspaceId: "ws-1",
      status: "PROCESSING",
      title: null,
      slug: null,
      markdown: null,
      steps: null,
      retainVideo: true,
      videoPath: "procedures/x.webm",
      error: null,
      attemptCount: 0,
      createdAt: "2026-07-21T12:00:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z",
    });

    renderPage();

    expect(
      await screen.findByText(/Gravação finalizada/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar envio" }));

    await waitFor(() => {
      expect(procedureApi.createProcedure).toHaveBeenCalledWith(
        "ws-1",
        blob,
        true,
      );
    });
    expect(discard).toHaveBeenCalled();
  });

  it("edits and publishes a pending procedure", async () => {
    const user = userEvent.setup();
    vi.mocked(procedureApi.listProcedures).mockResolvedValue([
      {
        id: "p-pending",
        workspaceId: "ws-1",
        status: "PENDING_REVIEW",
        title: "Número cancelado",
        slug: null,
        markdown: "## Título / tema\n\nold",
        steps: null,
        retainVideo: false,
        videoPath: null,
        error: null,
        attemptCount: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z",
      },
    ]);
    vi.mocked(procedureApi.updateProcedure).mockResolvedValue({
      id: "p-pending",
      workspaceId: "ws-1",
      status: "PENDING_REVIEW",
      title: "Fluxo ajustado",
      slug: null,
      markdown: "## Título / tema\n\nnew",
      steps: null,
      retainVideo: false,
      videoPath: null,
      error: null,
      attemptCount: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z",
    });
    vi.mocked(procedureApi.publishProcedure).mockResolvedValue({
      id: "p-pending",
      workspaceId: "ws-1",
      status: "PUBLISHED",
      title: "Fluxo ajustado",
      slug: "fluxo_ajustado",
      markdown: "## Título / tema\n\nnew",
      steps: ["passo"],
      retainVideo: false,
      videoPath: null,
      error: null,
      attemptCount: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z",
    });

    renderPage();
    await user.click(await screen.findByText("Número cancelado"));
    const titleInput = await screen.findByDisplayValue("Número cancelado");
    await user.clear(titleInput);
    await user.type(titleInput, "Fluxo ajustado");
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    await waitFor(() => {
      expect(procedureApi.publishProcedure).toHaveBeenCalledWith(
        "ws-1",
        "p-pending",
      );
    });
    expect(screen.getAllByText(/\/fluxo_ajustado/).length).toBeGreaterThan(0);
  });

  it("rejects pending procedure after confirm and removes from list", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(procedureApi.listProcedures).mockResolvedValue([
      {
        id: "p-pending",
        workspaceId: "ws-1",
        status: "PENDING_REVIEW",
        title: "Para rejeitar",
        slug: null,
        markdown: "## Título / tema\n\nx",
        steps: null,
        retainVideo: true,
        videoPath: "procedures/x.webm",
        error: null,
        attemptCount: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z",
      },
    ]);
    vi.mocked(procedureApi.rejectProcedure).mockResolvedValue(undefined);

    renderPage();
    await user.click(await screen.findByText("Para rejeitar"));
    await user.click(screen.getByRole("button", { name: "Rejeitar" }));

    await waitFor(() => {
      expect(procedureApi.rejectProcedure).toHaveBeenCalledWith(
        "ws-1",
        "p-pending",
      );
    });
    expect(screen.queryByText("Para rejeitar")).toBeNull();
  });
});
