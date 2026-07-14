import { describe, expect, it } from "vitest";

import { getToolLabel, messageSchema, messageToolUseSchema } from "./chat";

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

  it("returns fallback for unknown tools", () => {
    expect(getToolLabel("custom_tool")).toBe("Ferramenta: custom_tool");
  });
});
