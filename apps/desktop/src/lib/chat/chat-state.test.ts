import { describe, expect, it } from "vitest";

import {
  appendArtifact,
  appendReasoning,
  appendToMessage,
  appendToolUse,
  canReplyToMessage,
  canSendMessage,
  createAssistantPlaceholder,
  createReplyRef,
  createUserMessage,
  finalizeMessage,
  replyAuthorLabel,
  truncateReplyContent,
  upsertActivity,
} from "@/lib/chat/chat-state";

describe("createUserMessage", () => {
  it("creates a done user message with trimmed content", () => {
    const message = createUserMessage("u1", "  olá  ", 100);

    expect(message).toEqual({
      id: "u1",
      role: "user",
      content: "olá",
      createdAt: 100,
      status: "done",
    });
  });

  it("attaches reply metadata when provided", () => {
    const replyTo = { id: "a1", role: "assistant" as const, content: "resposta" };
    const message = createUserMessage("u2", "ok", 200, replyTo);

    expect(message.replyTo).toEqual(replyTo);
  });
});

describe("createAssistantPlaceholder", () => {
  it("creates a streaming assistant message", () => {
    const message = createAssistantPlaceholder("a1", 200);

    expect(message).toEqual({
      id: "a1",
      role: "assistant",
      content: "",
      createdAt: 200,
      status: "streaming",
    });
  });
});

describe("createReplyRef", () => {
  it("creates a reply ref from a completed message", () => {
    const message = createUserMessage("u1", "oi", 1);
    expect(createReplyRef(message)).toEqual({
      id: "u1",
      role: "user",
      content: "oi",
    });
  });

  it("returns undefined for streaming messages", () => {
    expect(createReplyRef(createAssistantPlaceholder("a1", 1))).toBeUndefined();
  });
});

describe("canReplyToMessage", () => {
  it("allows reply on completed messages with content", () => {
    expect(canReplyToMessage(createUserMessage("u1", "oi", 1))).toBe(true);
  });

  it("blocks reply on streaming messages", () => {
    expect(canReplyToMessage(createAssistantPlaceholder("a1", 1))).toBe(false);
  });
});

describe("replyAuthorLabel", () => {
  it("labels user messages as Você", () => {
    expect(replyAuthorLabel("user")).toBe("Você");
  });

  it("labels assistant messages as Assistente", () => {
    expect(replyAuthorLabel("assistant")).toBe("Assistente");
  });
});

describe("truncateReplyContent", () => {
  it("truncates long content with ellipsis", () => {
    const long = "a".repeat(150);
    expect(truncateReplyContent(long, 120)).toBe(`${"a".repeat(120)}…`);
  });
});

describe("appendToMessage", () => {
  it("appends chunk only to the matching message", () => {
    const messages = [
      createUserMessage("u1", "oi", 1),
      createAssistantPlaceholder("a1", 2),
    ];

    const result = appendToMessage(messages, "a1", "Olá");

    expect(result[0]?.content).toBe("oi");
    expect(result[1]?.content).toBe("Olá");
  });
});

describe("finalizeMessage", () => {
  it("marks the target message as done", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const result = finalizeMessage(messages, "a1");

    expect(result[0]?.status).toBe("done");
  });
});

describe("appendToolUse", () => {
  it("appends tool use to matching message", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const result = appendToolUse(messages, "a1", {
      name: "search_knowledge",
      label: "Base de conhecimento",
    });
    expect(result[0]?.toolUses).toEqual([
      { name: "search_knowledge", label: "Base de conhecimento" },
    ]);
  });
});

describe("upsertActivity", () => {
  it("inserts and updates activities by id", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const withRunning = upsertActivity(messages, "a1", {
      id: "start",
      label: "Analisando…",
      status: "running",
    });
    const withDone = upsertActivity(withRunning, "a1", {
      id: "start",
      label: "Analisando…",
      status: "done",
    });
    expect(withDone[0]?.activities).toEqual([
      { id: "start", label: "Analisando…", status: "done" },
    ]);
  });
});

describe("appendArtifact", () => {
  const pdf = {
    id: "doc-1",
    kind: "pdf" as const,
    title: "Relatório",
    filename: "relatorio.pdf",
    sizeBytes: 2048,
    pageCount: 2,
  };

  it("appends artifacts to the matching message", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const withOne = appendArtifact(messages, "a1", pdf);
    const withTwo = appendArtifact(withOne, "a1", { ...pdf, id: "doc-2" });

    expect(withTwo[0]?.artifacts).toEqual([pdf, { ...pdf, id: "doc-2" }]);
  });

  it("ignores an artifact already present", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const withOne = appendArtifact(messages, "a1", pdf);
    const again = appendArtifact(withOne, "a1", pdf);

    expect(again[0]?.artifacts).toHaveLength(1);
    expect(again[0]).toBe(withOne[0]);
  });

  it("leaves other messages untouched", () => {
    const messages = [
      createAssistantPlaceholder("a1", 1),
      createAssistantPlaceholder("a2", 2),
    ];
    const next = appendArtifact(messages, "a1", pdf);

    expect(next[1]?.artifacts).toBeUndefined();
  });
});

describe("appendReasoning", () => {
  it("appends reasoning chunks to matching message", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const first = appendReasoning(messages, "a1", "parte 1 ");
    const second = appendReasoning(first, "a1", "parte 2");
    expect(second[0]?.reasoning).toBe("parte 1 parte 2");
  });
});

describe("canSendMessage", () => {
  it("allows send when content is non-empty and not responding", () => {
    expect(canSendMessage("oi", false)).toBe(true);
  });

  it("blocks empty content", () => {
    expect(canSendMessage("   ", false)).toBe(false);
  });

  it("blocks while responding", () => {
    expect(canSendMessage("oi", true)).toBe(false);
  });
});
