import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";

describe("active-conversation-store", () => {
  const scope = { userId: "user-1", workspaceId: "ws-1" };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("T1.1 load vazio retorna null", () => {
    expect(loadActiveConversationId(scope)).toBeNull();
  });

  it("T1.2 save + load faz round-trip do id", () => {
    saveActiveConversationId("conv-ilha-1", scope);
    expect(loadActiveConversationId(scope)).toBe("conv-ilha-1");
  });

  it("T1.3 save(null) remove a chave", () => {
    saveActiveConversationId("conv-ilha-1", scope);
    saveActiveConversationId(null);
    expect(loadActiveConversationId(scope)).toBeNull();
    expect(localStorage.getItem("linvo:island-active-conversation")).toBeNull();
  });

  it("não carrega conversa de outro usuário ou workspace", () => {
    saveActiveConversationId("conv-ilha-1", scope);

    expect(
      loadActiveConversationId({ userId: "user-2", workspaceId: "ws-1" }),
    ).toBeNull();
    expect(
      loadActiveConversationId({ userId: "user-1", workspaceId: "ws-2" }),
    ).toBeNull();
    expect(loadActiveConversationId(scope)).toBe("conv-ilha-1");
  });

  it("rejeita o formato legado sem escopo", () => {
    localStorage.setItem("linvo:island-active-conversation", "conv-legada");

    expect(loadActiveConversationId(scope)).toBeNull();
  });

  it("T1.4 localStorage lança: load retorna null e save não explode", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(loadActiveConversationId(scope)).toBeNull();
    expect(() => saveActiveConversationId("conv-x", scope)).not.toThrow();
    expect(() => saveActiveConversationId(null)).not.toThrow();
  });
});
