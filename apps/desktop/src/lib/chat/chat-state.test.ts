import { describe, expect, it } from "vitest";

import {
  appendArtifact,
  appendCitation,
  appendReasoning,
  appendToMessage,
  appendToolUse,
  canReplyToMessage,
  canSendMessage,
  createAssistantPlaceholder,
  createReplyRef,
  createUserMessage,
  finalizeMessage,
  mergeAssistantDoneMessage,
  replyAuthorLabel,
  setCaptureSummary,
  setMessageCitations,
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

  it("allows empty content when an attachment is present", () => {
    expect(canSendMessage("   ", false, { hasAttachment: true })).toBe(true);
  });

  it("blocks while responding", () => {
    expect(canSendMessage("oi", true)).toBe(false);
  });
});

describe("createReplyRef with attachments", () => {
  it("allows reply for attachment-only user messages", () => {
    const message = createUserMessage("u1", "", 1, undefined, [
      {
        id: "att_1",
        kind: "image",
        mimeType: "image/png",
        filename: "context.png",
        sizeBytes: 10,
      },
    ]);
    expect(createReplyRef(message)).toEqual({
      id: "u1",
      role: "user",
      content: "Contexto visual",
    });
  });
});

describe("appendCitation", () => {
  const citation = {
    id: "d1",
    kind: "document" as const,
    label: "Política comercial",
  };

  it("appends citations to the matching message", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const withOne = appendCitation(messages, "a1", citation);
    const withTwo = appendCitation(withOne, "a1", {
      ...citation,
      id: "p1",
      kind: "procedure",
      label: "Cancelar plano",
    });

    expect(withTwo[0]?.citations).toEqual([
      citation,
      { id: "p1", kind: "procedure", label: "Cancelar plano" },
    ]);
  });

  it("ignores a citation already present", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const withOne = appendCitation(messages, "a1", citation);
    const again = appendCitation(withOne, "a1", citation);

    expect(again[0]?.citations).toHaveLength(1);
    expect(again[0]).toBe(withOne[0]);
  });
});

describe("setMessageCitations", () => {
  it("keeps citations: [] as a search miss", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const result = setMessageCitations(messages, "a1", []);

    expect(result[0]?.citations).toEqual([]);
    expect(result[0]?.citations).not.toBeUndefined();
  });
});

describe("setCaptureSummary", () => {
  it("sets captureSummary bullets on the matching message", () => {
    const messages = [createAssistantPlaceholder("a1", 1)];
    const bullets = ["pedido", "protocolo 123", "sem multa"];
    const result = setCaptureSummary(messages, "a1", bullets);

    expect(result[0]?.captureSummary).toEqual(bullets);
    expect(result[1]).toBeUndefined();
  });
});

describe("mergeAssistantDoneMessage", () => {
  it("keeps local citations when done omits the field", () => {
    const local = {
      ...createAssistantPlaceholder("a1", 1),
      content: "com fonte",
      citations: [
        { id: "d1", kind: "document" as const, label: "Política comercial" },
      ],
    };
    const mapped = {
      ...local,
      id: "asst-1",
      status: "done" as const,
      citations: undefined,
    };

    expect(mergeAssistantDoneMessage(mapped, local).citations).toEqual([
      { id: "d1", kind: "document", label: "Política comercial" },
    ]);
  });

  it("uses citations: [] from done as a search miss", () => {
    const local = createAssistantPlaceholder("a1", 1);
    const mapped = {
      ...local,
      status: "done" as const,
      citations: [],
    };

    expect(mergeAssistantDoneMessage(mapped, local).citations).toEqual([]);
  });

  it("keeps local captureSummary when done omits the field", () => {
    const local = {
      ...createAssistantPlaceholder("a1", 1),
      captureSummary: ["pedido de cancelamento"],
    };
    const mapped = {
      ...local,
      status: "done" as const,
      captureSummary: undefined,
    };

    expect(mergeAssistantDoneMessage(mapped, local).captureSummary).toEqual([
      "pedido de cancelamento",
    ]);
  });
});
