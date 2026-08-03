import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PanelSidebar } from "@/components/panel/panel-sidebar";
import type { PanelSession } from "@/hooks/use-panel-session";

const deleteConversation = vi.fn();
const selectConversation = vi.fn();
const createConversation = vi.fn();

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
    activeId: "conv-1",
    isLoading: false,
    error: null,
    createConversation,
    deleteConversation,
    selectConversation,
    syncActiveId: vi.fn(),
    refreshList: vi.fn(),
    updateConversationTitle: vi.fn(),
  }),
}));

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: () => ({
    workspaces: [],
    activeWorkspace: null,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    selectWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
  }),
}));

const session: PanelSession = {
  user: {
    id: "u1",
    name: "Renan",
    email: "renan@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  logout: vi.fn(async () => undefined),
};

describe("PanelSidebar delete conversation", () => {
  beforeEach(() => {
    deleteConversation.mockReset();
    selectConversation.mockReset();
    createConversation.mockReset();
    vi.spyOn(window, "confirm").mockReset();
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/chat/conv-1"]}>
        <PanelSidebar session={session} collapsed={false} />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /apagar conversa conversa a/i }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Os PDFs gerados nela saem do workspace"),
    );
    expect(deleteConversation).not.toHaveBeenCalled();
  });

  it("deletes when confirmation is accepted", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteConversation.mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/chat/conv-1"]}>
        <PanelSidebar session={session} collapsed={false} />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /apagar conversa conversa a/i }),
    );

    expect(deleteConversation).toHaveBeenCalledWith("conv-1");
  });
});
