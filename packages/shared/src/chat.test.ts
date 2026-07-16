import { describe, expect, it } from "vitest";

import {
  getToolLabel,
  messageSchema,
  messageToolUseSchema,
  toolRequestSchema,
  toolResultInputSchema,
} from "./chat";

describe("messageToolUseSchema", () => {
  it("validates name and label", () => {
    const parsed = messageToolUseSchema.parse({
      name: "search_knowledge",
      label: "Base de conhecimento",
    });
    expect(parsed.name).toBe("search_knowledge");
  });
});

describe("messageSchema toolUses", () => {
  it("round-trips optional toolUses", () => {
    const message = messageSchema.parse({
      id: "m1",
      role: "assistant",
      content: "Resposta",
      status: "done",
      createdAt: "2026-01-01T00:00:00.000Z",
      toolUses: [{ name: "search_knowledge", label: "Base de conhecimento" }],
    });
    expect(message.toolUses).toHaveLength(1);
  });
});

describe("getToolLabel", () => {
  it("returns mapped label for search_knowledge", () => {
    expect(getToolLabel("search_knowledge")).toBe("Base de conhecimento");
  });

  it("returns mapped labels for web_search and read_clipboard", () => {
    expect(getToolLabel("web_search")).toBe("Busca na internet");
    expect(getToolLabel("read_clipboard")).toBe("Área de transferência");
  });

  it("returns fallback for unknown tools", () => {
    expect(getToolLabel("custom_tool")).toBe("Ferramenta: custom_tool");
  });
});

describe("awaiting_tool status", () => {
  it("accepts awaiting_tool on messageSchema", () => {
    const message = messageSchema.parse({
      id: "m1",
      role: "assistant",
      content: "",
      status: "awaiting_tool",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(message.status).toBe("awaiting_tool");
  });
});

describe("toolRequestSchema", () => {
  it("parses tool request payload", () => {
    const parsed = toolRequestSchema.parse({
      requestId: "req-1",
      name: "read_clipboard",
      label: "Área de transferência",
      args: {},
      requiresApproval: true,
    });
    expect(parsed.requestId).toBe("req-1");
  });
});

describe("toolResultInputSchema", () => {
  it("requires result when approved", () => {
    expect(() =>
      toolResultInputSchema.parse({ requestId: "r1", approved: true }),
    ).toThrow();
  });

  it("allows deny without result", () => {
    const parsed = toolResultInputSchema.parse({
      requestId: "r1",
      approved: false,
    });
    expect(parsed.approved).toBe(false);
  });
});
