import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleDiscoverySessionDetail } from "@linvo/shared";

import { useRuleDiscoverySession } from "@/hooks/use-rule-discovery-session";
import * as ruleDiscoveryApi from "@/lib/workspace/rule-discovery-api";

vi.mock("@/lib/workspace/rule-discovery-api", () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
}));

function makeSession(
  overrides: Partial<RuleDiscoverySessionDetail> = {},
): RuleDiscoverySessionDetail {
  return {
    id: "session-1",
    workspaceId: "ws-1",
    status: "PROCESSING",
    approvalMode: "QUESTION",
    confidenceThreshold: 0.7,
    error: null,
    documents: [],
    candidates: [],
    events: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useRuleDiscoverySession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(ruleDiscoveryApi.createSession).mockReset();
    vi.mocked(ruleDiscoveryApi.getSession).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls incrementally until the session is ready", async () => {
    vi.mocked(ruleDiscoveryApi.createSession).mockResolvedValue(
      makeSession({ status: "PROCESSING" }),
    );
    vi.mocked(ruleDiscoveryApi.getSession)
      .mockResolvedValueOnce(
        makeSession({ status: "PROCESSING", candidates: [] }),
      )
      .mockResolvedValueOnce(
        makeSession({ status: "READY", candidates: [] }),
      );

    const { result } = renderHook(() => useRuleDiscoverySession("ws-1"));

    await act(async () => {
      await result.current.start([new File(["a"], "a.pdf")]);
    });
    expect(result.current.session?.status).toBe("PROCESSING");
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.session?.status).toBe("PROCESSING");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.session?.status).toBe("READY");
    expect(result.current.isPolling).toBe(false);

    const callsAtReady = vi.mocked(ruleDiscoveryApi.getSession).mock.calls
      .length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(vi.mocked(ruleDiscoveryApi.getSession).mock.calls.length).toBe(
      callsAtReady,
    );
  });

  it("stops polling on unmount without cancelling the session", async () => {
    vi.mocked(ruleDiscoveryApi.createSession).mockResolvedValue(
      makeSession({ status: "PROCESSING" }),
    );
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue(
      makeSession({ status: "PROCESSING" }),
    );

    const { result, unmount } = renderHook(() =>
      useRuleDiscoverySession("ws-1"),
    );

    await act(async () => {
      await result.current.start([new File(["a"], "a.pdf")]);
    });

    unmount();
    const callsAtUnmount = vi.mocked(ruleDiscoveryApi.getSession).mock.calls
      .length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(vi.mocked(ruleDiscoveryApi.getSession).mock.calls.length).toBe(
      callsAtUnmount,
    );
  });

  it("refetches immediately when remounted with a previous session id", async () => {
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue(
      makeSession({ status: "READY", candidates: [] }),
    );

    const { result } = renderHook(() =>
      useRuleDiscoverySession("ws-1", "session-1"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.session?.status).toBe("READY");
    expect(ruleDiscoveryApi.getSession).toHaveBeenCalledWith(
      "ws-1",
      "session-1",
    );
  });

  it("pauses outside the knowledge step and refreshes immediately on return", async () => {
    vi.mocked(ruleDiscoveryApi.createSession).mockResolvedValue(
      makeSession({ status: "PROCESSING" }),
    );
    vi.mocked(ruleDiscoveryApi.getSession).mockResolvedValue(
      makeSession({ status: "READY" }),
    );

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useRuleDiscoverySession("ws-1", null, enabled),
      { initialProps: { enabled: true } },
    );

    await act(async () => {
      await result.current.start([new File(["a"], "a.pdf")]);
    });

    rerender({ enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(ruleDiscoveryApi.getSession).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await act(async () => Promise.resolve());

    expect(ruleDiscoveryApi.getSession).toHaveBeenCalledWith(
      "ws-1",
      "session-1",
    );
    expect(result.current.session?.status).toBe("READY");
  });

  it("surfaces an error without throwing when creating the session fails", async () => {
    vi.mocked(ruleDiscoveryApi.createSession).mockRejectedValue(
      new Error("network"),
    );

    const { result } = renderHook(() => useRuleDiscoverySession("ws-1"));

    await act(async () => {
      await result.current.start([new File(["a"], "a.pdf")]);
    });

    expect(result.current.error).toBe("Não foi possível enviar os documentos");
    expect(result.current.session).toBeNull();
  });

  it("stops polling when refreshing the session fails", async () => {
    vi.mocked(ruleDiscoveryApi.createSession).mockResolvedValue(
      makeSession({ status: "PROCESSING" }),
    );
    vi.mocked(ruleDiscoveryApi.getSession).mockRejectedValue(
      new Error("network"),
    );

    const { result } = renderHook(() => useRuleDiscoverySession("ws-1"));

    await act(async () => {
      await result.current.start([new File(["a"], "a.pdf")]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(result.current.isPolling).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(ruleDiscoveryApi.getSession).toHaveBeenCalledTimes(1);
  });
});
