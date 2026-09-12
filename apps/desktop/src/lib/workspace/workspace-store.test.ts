import { beforeEach, describe, expect, it } from "vitest";

import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";
import {
  clearStoredWorkspaceId,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "@/lib/workspace/workspace-store";

describe("workspace-store", () => {
  const scope = { userId: "user-1", workspaceId: "ws-1" };

  beforeEach(() => {
    localStorage.clear();
  });

  it("mantém a conversa ao reafirmar o mesmo workspace", () => {
    setStoredWorkspaceId(scope.workspaceId);
    saveActiveConversationId("conv-1", scope);

    setStoredWorkspaceId(scope.workspaceId);

    expect(getStoredWorkspaceId()).toBe(scope.workspaceId);
    expect(loadActiveConversationId(scope)).toBe("conv-1");
  });

  it("limpa a conversa ativa ao trocar de workspace", () => {
    setStoredWorkspaceId(scope.workspaceId);
    saveActiveConversationId("conv-1", scope);

    setStoredWorkspaceId("ws-2");

    expect(getStoredWorkspaceId()).toBe("ws-2");
    expect(loadActiveConversationId(scope)).toBeNull();
  });

  it("clear remove a conversa mesmo sem workspace armazenado", () => {
    saveActiveConversationId("conv-1", scope);

    clearStoredWorkspaceId();

    expect(getStoredWorkspaceId()).toBeNull();
    expect(localStorage.getItem("linvo:island-active-conversation")).toBeNull();
  });
});
