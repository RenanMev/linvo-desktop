import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ruleDiscovery: {
    session: null as {
      id: string;
      candidates: unknown[];
    } | null,
    start: vi.fn(),
    refresh: vi.fn(),
    isPolling: false,
    error: null,
  },
  saveOnboardingProgress: vi.fn(),
}));

vi.mock("@/hooks/use-rule-discovery-session", () => ({
  useRuleDiscoverySession: () => mocks.ruleDiscovery,
}));

vi.mock("@/lib/onboarding/onboarding-progress-store", () => ({
  saveOnboardingProgress: mocks.saveOnboardingProgress,
}));

vi.mock("@/lib/workspace/workspace-api", () => ({
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  uploadWorkspaceImage: vi.fn(),
  createBusinessRule: vi.fn(),
}));

import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import * as workspaceApi from "@/lib/workspace/workspace-api";

function makeWorkspace(id: string, name: string) {
  return {
    id,
    name,
    role: "OWNER" as const,
    imageUrl: null,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
}

describe("useOnboardingFlow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.ruleDiscovery.session = null;
    mocks.ruleDiscovery.start.mockResolvedValue(undefined);
    mocks.ruleDiscovery.refresh.mockResolvedValue(null);
    vi.mocked(workspaceApi.listWorkspaces).mockResolvedValue([]);
  });

  it("creates at most one workspace when revisiting the step", async () => {
    vi.mocked(workspaceApi.createWorkspace).mockResolvedValue(
      makeWorkspace("ws-new", "Primeiro"),
    );
    vi.mocked(workspaceApi.updateWorkspace).mockImplementation(
      async (_id, input) => makeWorkspace("ws-new", input.name ?? "Primeiro"),
    );

    const { result } = renderHook(() =>
      useOnboardingFlow({
        userId: "user-1",
        onComplete: vi.fn(),
      }),
    );

    act(() => result.current.next());
    act(() => result.current.setWorkspaceName("Primeiro"));
    await act(async () => result.current.confirmWorkspace());

    act(() => result.current.goTo("workspace"));
    act(() => result.current.setWorkspaceName("Segundo"));
    await act(async () => result.current.confirmWorkspace());

    act(() => result.current.goTo("workspace"));
    act(() => result.current.setWorkspaceName("Terceiro"));
    await act(async () => result.current.confirmWorkspace());

    expect(workspaceApi.createWorkspace).toHaveBeenCalledTimes(1);
    expect(workspaceApi.updateWorkspace).toHaveBeenCalledTimes(2);
  });

  it("retries only failed business rules", async () => {
    vi.mocked(workspaceApi.listWorkspaces).mockResolvedValue([
      makeWorkspace("ws-1", "Linvo"),
    ]);
    vi.mocked(workspaceApi.createBusinessRule)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({} as never);

    const { result } = renderHook(() =>
      useOnboardingFlow({
        userId: "user-1",
        onComplete: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.activeWorkspaceId).toBe("ws-1"));
    act(() => result.current.next());
    await act(async () => result.current.confirmWorkspace());

    act(() => {
      result.current.addRule();
      result.current.addRule();
    });
    act(() => {
      result.current.updateRule("onboarding-rule-1", {
        title: "Tom",
        content: "Seja direto",
      });
      result.current.updateRule("onboarding-rule-2", {
        title: "",
        content: "Escalone casos críticos",
      });
    });

    await act(async () => result.current.confirmContext());

    expect(result.current.rules.map((rule) => rule.status)).toEqual([
      "saved",
      "error",
    ]);
    expect(result.current.error).toContain("1 regra falhou");

    await act(async () => result.current.confirmContext());

    expect(workspaceApi.createBusinessRule).toHaveBeenCalledTimes(3);
    expect(workspaceApi.createBusinessRule).toHaveBeenNthCalledWith(
      3,
      "ws-1",
      {
        title: "Contexto inicial",
        content: "Escalone casos críticos",
      },
    );
  });

  it("resolves the final route from knowledge intent and candidates", async () => {
    vi.mocked(workspaceApi.listWorkspaces).mockResolvedValue([
      makeWorkspace("ws-1", "Linvo"),
    ]);
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(() =>
      useOnboardingFlow({
        userId: "user-1",
        onComplete,
      }),
    );

    await waitFor(() => expect(result.current.activeWorkspaceId).toBe("ws-1"));

    act(() => result.current.setKnowledgeIntent("procedures"));
    await act(async () => result.current.finish());
    expect(onComplete).toHaveBeenLastCalledWith(
      "/settings/workspace/ws-1/procedures",
    );

    mocks.ruleDiscovery.session = {
      id: "session-1",
      candidates: [{}],
    };
    mocks.ruleDiscovery.refresh.mockResolvedValue(mocks.ruleDiscovery.session);
    rerender();
    act(() => result.current.setKnowledgeIntent("rule-review"));
    await act(async () => result.current.finish());
    expect(onComplete).toHaveBeenLastCalledWith(
      "/settings/workspace/ws-1/rule-review",
    );

    mocks.ruleDiscovery.session = {
      id: "session-1",
      candidates: [],
    };
    mocks.ruleDiscovery.refresh.mockResolvedValue(mocks.ruleDiscovery.session);
    rerender();
    await act(async () => result.current.finish());
    expect(onComplete).toHaveBeenLastCalledWith("/chat");
  });

  it("persists progress on every navigation transition", async () => {
    const { result } = renderHook(() =>
      useOnboardingFlow({
        userId: "user-1",
        onComplete: vi.fn(),
      }),
    );

    await act(async () => Promise.resolve());
    act(() => result.current.next());
    act(() => result.current.back());
    act(() => result.current.next());
    act(() => result.current.skip());

    expect(mocks.saveOnboardingProgress).toHaveBeenCalledTimes(4);
    expect(mocks.saveOnboardingProgress).toHaveBeenLastCalledWith(
      "user-1",
      expect.objectContaining({ stepId: "context" }),
    );
  });
});
