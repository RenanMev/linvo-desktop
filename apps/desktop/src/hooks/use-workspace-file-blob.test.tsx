import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceFileBlob } from "@/hooks/use-workspace-file-blob";
import { authorizedFetch } from "@/lib/auth/http";

vi.mock("@/lib/auth/http", () => ({
  authorizedFetch: vi.fn(),
}));

const createObjectURLMock = vi.fn(() => "blob:workspace-image");
const revokeObjectURLMock = vi.fn();

describe("useWorkspaceFileBlob", () => {
  beforeEach(() => {
    vi.mocked(authorizedFetch).mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
  });

  it("does not fetch when the URL is null", () => {
    const { result } = renderHook(() => useWorkspaceFileBlob(null));

    expect(authorizedFetch).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      blobUrl: null,
      loading: false,
      error: null,
    });
  });

  it("fetches with authorization and exposes an object URL", async () => {
    const response = new Response(new Blob(["image"]), { status: 200 });
    vi.mocked(authorizedFetch).mockResolvedValue(response);

    const { result } = renderHook(() =>
      useWorkspaceFileBlob("http://localhost:3001/api/workspaces/ws-1/file"),
    );

    await waitFor(() =>
      expect(result.current.blobUrl).toBe("blob:workspace-image"),
    );
    expect(authorizedFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/workspaces/ws-1/file",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(expect.any(Blob));
    expect(result.current.error).toBeNull();
  });

  it("never sends credentials to an external image origin", () => {
    const { result } = renderHook(() =>
      useWorkspaceFileBlob("https://cdn.example.com/workspace.webp"),
    );

    expect(authorizedFetch).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      blobUrl: "https://cdn.example.com/workspace.webp",
      loading: false,
      error: null,
    });
  });

  it("revokes the object URL on cleanup", async () => {
    vi.mocked(authorizedFetch).mockResolvedValue(
      new Response(new Blob(["image"]), { status: 200 }),
    );

    const { result, unmount } = renderHook(() =>
      useWorkspaceFileBlob("http://localhost:3001/api/workspaces/ws-1/file"),
    );
    await waitFor(() => expect(result.current.blobUrl).not.toBeNull());

    unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:workspace-image");
  });

  it("exposes an error when the protected file request fails", async () => {
    vi.mocked(authorizedFetch).mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    const { result } = renderHook(() =>
      useWorkspaceFileBlob("http://localhost:3001/api/workspaces/ws-1/missing"),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.blobUrl).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });
});
