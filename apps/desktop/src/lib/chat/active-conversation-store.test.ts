import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";

describe("active-conversation-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("T1.1 load vazio retorna null", () => {
    expect(loadActiveConversationId()).toBeNull();
  });

  it("T1.2 save + load faz round-trip do id", () => {
    saveActiveConversationId("conv-ilha-1");
    expect(loadActiveConversationId()).toBe("conv-ilha-1");
  });

  it("T1.3 save(null) remove a chave", () => {
    saveActiveConversationId("conv-ilha-1");
    saveActiveConversationId(null);
    expect(loadActiveConversationId()).toBeNull();
    expect(localStorage.getItem("linvo:island-active-conversation")).toBeNull();
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

    expect(loadActiveConversationId()).toBeNull();
    expect(() => saveActiveConversationId("conv-x")).not.toThrow();
    expect(() => saveActiveConversationId(null)).not.toThrow();
  });
});
