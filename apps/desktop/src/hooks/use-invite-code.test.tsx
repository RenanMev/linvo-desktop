import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInviteCode } from "@/hooks/use-invite-code";

const getActiveInviteCode = vi.fn();
const generateInviteCode = vi.fn();
const revokeInviteCode = vi.fn();

vi.mock("@/lib/workspace/invite-api", () => ({
  getActiveInviteCode: (...args: unknown[]) => getActiveInviteCode(...args),
  generateInviteCode: (...args: unknown[]) => generateInviteCode(...args),
  revokeInviteCode: (...args: unknown[]) => revokeInviteCode(...args),
}));

describe("useInviteCode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getActiveInviteCode.mockReset();
    generateInviteCode.mockReset();
    revokeInviteCode.mockReset();
    getActiveInviteCode.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves to expired when countdown reaches zero and confirms with API", async () => {
    const expiresAt = new Date(Date.now() + 1500).toISOString();
    getActiveInviteCode
      .mockResolvedValueOnce({
        id: "inv-1",
        workspaceId: "ws-1",
        expiresAt,
        createdAt: new Date().toISOString(),
        redeemedAt: null,
        redeemedByName: null,
      })
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useInviteCode("ws-1"));

    await waitFor(() => {
      expect(result.current.uiState).toBe("active-without-value");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await waitFor(() => {
      expect(result.current.uiState).toBe("expired");
    });
  });

  it("shows redeemed state when polling returns redeemedAt", async () => {
    getActiveInviteCode
      .mockResolvedValueOnce({
        id: "inv-1",
        workspaceId: "ws-1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        redeemedAt: null,
        redeemedByName: null,
      })
      .mockResolvedValueOnce({
        id: "inv-1",
        workspaceId: "ws-1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        redeemedAt: new Date().toISOString(),
        redeemedByName: "João Pereira",
      });

    const onRedeemed = vi.fn();
    const { result } = renderHook(() => useInviteCode("ws-1"));

    await waitFor(() => {
      expect(result.current.uiState).toBe("active-without-value");
    });

    act(() => {
      result.current.setOnRedeemed(onRedeemed);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => {
      expect(result.current.uiState).toBe("redeemed");
      expect(result.current.redeemerName).toBe("João Pereira");
    });
    expect(onRedeemed).toHaveBeenCalled();
  });

  it("keeps active-without-value after remount when plaintext is gone", async () => {
    getActiveInviteCode.mockResolvedValue({
      id: "inv-1",
      workspaceId: "ws-1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      redeemedAt: null,
      redeemedByName: null,
    });

    const first = renderHook(() => useInviteCode("ws-1"));
    await waitFor(() => {
      expect(first.result.current.uiState).toBe("active-without-value");
    });
    first.unmount();

    const second = renderHook(() => useInviteCode("ws-1"));
    await waitFor(() => {
      expect(second.result.current.uiState).toBe("active-without-value");
      expect(second.result.current.plaintextCode).toBeNull();
    });
  });

  it("ignores network errors during polling without changing state", async () => {
    getActiveInviteCode
      .mockResolvedValueOnce({
        id: "inv-1",
        workspaceId: "ws-1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        redeemedAt: null,
        redeemedByName: null,
      })
      .mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useInviteCode("ws-1"));
    await waitFor(() => {
      expect(result.current.uiState).toBe("active-without-value");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.uiState).toBe("active-without-value");
    expect(result.current.error).toBeNull();
  });
});
