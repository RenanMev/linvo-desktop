import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceDetailPage } from "@/pages/settings/workspace-detail-page";

const ownerWorkspace = {
  id: "ws-1",
  name: "Workspace Teste",
  role: "OWNER" as const,
  imageUrl: null,
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

const memberWorkspace = {
  ...ownerWorkspace,
  role: "MEMBER" as const,
};

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: vi.fn(),
}));

vi.mock("@/lib/workspace/workspace-api", () => ({
  listBusinessRules: vi.fn().mockResolvedValue([]),
  resolveWorkspaceImageUrl: vi.fn(() => null),
}));

import { useWorkspace } from "@/context/workspace-context";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/workspace/ws-1"]}>
      <Routes>
        <Route
          path="/settings/workspace/:workspaceId"
          element={<WorkspaceDetailPage />}
        />
        <Route
          path="/settings/workspace/:workspaceId/rule-review"
          element={<div>Rule Review Route</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspaceDetailPage rule review navigation", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("shows Rule Review link for OWNER", async () => {
    vi.mocked(useWorkspace).mockReturnValue({
      workspaces: [ownerWorkspace],
      activeWorkspace: ownerWorkspace,
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
      await screen.findByRole("button", { name: "Abrir Rule Review" }),
    ).toBeInTheDocument();
  });

  it("navigates to rule review route for OWNER", async () => {
    const user = userEvent.setup();
    vi.mocked(useWorkspace).mockReturnValue({
      workspaces: [ownerWorkspace],
      activeWorkspace: ownerWorkspace,
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
    await user.click(
      await screen.findByRole("button", { name: "Abrir Rule Review" }),
    );

    expect(await screen.findByText("Rule Review Route")).toBeInTheDocument();
  });

  it("hides Rule Review link for MEMBER", async () => {
    vi.mocked(useWorkspace).mockReturnValue({
      workspaces: [memberWorkspace],
      activeWorkspace: memberWorkspace,
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

    expect(await screen.findByText("Regras de negócio")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abrir Rule Review" }),
    ).toBeNull();
  });
});
