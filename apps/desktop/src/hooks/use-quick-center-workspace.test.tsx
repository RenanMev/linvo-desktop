import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickCenterWorkspace } from "@/hooks/use-quick-center-workspace";
import * as workspaceApi from "@/lib/workspace/workspace-api";
import { setStoredWorkspaceId } from "@/lib/workspace/workspace-store";

vi.mock("@/lib/workspace/workspace-api", () => ({
  listWorkspaces: vi.fn(),
}));

function makeWorkspace(id: string, name: string) {
  return { id, name, createdAt: "2026-01-01T00:00:00.000Z" };
}

describe("useQuickCenterWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(workspaceApi.listWorkspaces).mockReset();
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useQuickCenterWorkspace(false));
    expect(workspaceApi.listWorkspaces).not.toHaveBeenCalled();
  });

  it("resolves the active workspace name when enabled", async () => {
    setStoredWorkspaceId("ws-2");
    vi.mocked(workspaceApi.listWorkspaces).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeWorkspace("ws-1", "Alpha") as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeWorkspace("ws-2", "Beta") as any,
    ]);

    const { result } = renderHook(() => useQuickCenterWorkspace(true));

    await waitFor(() => expect(result.current.name).toBe("Beta"));
    expect(result.current.isLoading).toBe(false);
  });

  it("returns null when the stored id has no match", async () => {
    setStoredWorkspaceId("missing");
    vi.mocked(workspaceApi.listWorkspaces).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeWorkspace("ws-1", "Alpha") as any,
    ]);

    const { result } = renderHook(() => useQuickCenterWorkspace(true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.name).toBeNull();
  });
});
