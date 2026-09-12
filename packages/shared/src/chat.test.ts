import { describe, expect, it } from "vitest";

import {
  chatAttachmentUploadResponseSchema,
  chatErrorCodeSchema,
  chatErrorEventSchema,
  getToolLabel,
  messageActivitySchema,
  messageArtifactSchema,
  messageAttachmentSchema,
  messageCitationKindSchema,
  messageCitationSchema,
  messageSchema,
  messageToolUseSchema,
  reasoningChunkSchema,
  regenerateMessageInputSchema,
  sendMessageInputSchema,
  toolRequestSchema,
  toolResultInputSchema,
} from "./chat";

describe("chatErrorEventSchema", () => {
  it("aceita evento sem code (compatibilidade retroativa)", () => {
    const parsed = chatErrorEventSchema.parse({ message: "falhou" });
    expect(parsed.code).toBeUndefined();
  });

  it("aceita todos os codes definidos", () => {
    for (const code of chatErrorCodeSchema.options) {
      const parsed = chatErrorEventSchema.parse({ message: "x", code });
      expect(parsed.code).toBe(code);
    }
  });

  it("rejeita code desconhecido", () => {
    expect(() =>
      chatErrorEventSchema.parse({ message: "x", code: "nao_existe" }),
    ).toThrow();
  });
});

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

describe("messageSchema reasoning", () => {
  it("round-trips optional reasoning", () => {
    const message = messageSchema.parse({
      id: "m1",
      role: "assistant",
      content: "Resposta",
      status: "done",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoning: "Vou consultar a base primeiro.",
    });
    expect(message.reasoning).toBe("Vou consultar a base primeiro.");
  });
});

describe("messageActivitySchema", () => {
  it("validates activity payload", () => {
    const parsed = messageActivitySchema.parse({
      id: "act-1",
      label: "Base de conhecimento",
      status: "running",
    });
    expect(parsed.status).toBe("running");
  });

  it("accepts kind and detail", () => {
    const parsed = messageActivitySchema.parse({
      id: "act-2",
      label: "Base de conhecimento",
      status: "done",
      kind: "research",
      detail: "cancelamento",
    });
    expect(parsed.kind).toBe("research");
    expect(parsed.detail).toBe("cancelamento");
  });
});

describe("messageSchema activities", () => {
  it("round-trips optional activities", () => {
    const message = messageSchema.parse({
      id: "m1",
      role: "assistant",
      content: "Resposta",
      status: "done",
      createdAt: "2026-01-01T00:00:00.000Z",
      activities: [
        {
          id: "a1",
          label: "Base de conhecimento",
          status: "done",
          kind: "research",
        },
      ],
    });
    expect(message.activities).toHaveLength(1);
  });
});

describe("sendMessageInputSchema deskState", () => {
  it("accepts deskState snapshot", () => {
    const parsed = sendMessageInputSchema.parse({
      content: "em que passo estou?",
      deskState: {
        screenKey: "chat",
        openProcedure: {
          slug: "cancelamento",
          title: "Cancelamento",
          stepCount: 3,
          currentStepIndex: 1,
          completedStepIndexes: [0],
        },
      },
    });
    expect(parsed.deskState?.openProcedure?.slug).toBe("cancelamento");
  });

  it("accepts model override", () => {
    const parsed = sendMessageInputSchema.parse({
      content: "oi",
      model: "gpt-4o",
    });
    expect(parsed.model).toBe("gpt-4o");
  });

  it("accepts forceTool web_search", () => {
    const parsed = sendMessageInputSchema.parse({
      content: "sobre cancelamento",
      forceTool: "web_search",
    });
    expect(parsed.forceTool).toBe("web_search");
  });

  it("rejects unknown forceTool", () => {
    expect(() =>
      sendMessageInputSchema.parse({
        content: "oi",
        forceTool: "bash",
      }),
    ).toThrow();
  });

  it("accepts attachmentIds with empty content", () => {
    const parsed = sendMessageInputSchema.parse({
      content: "",
      attachmentIds: ["att_1"],
    });
    expect(parsed.attachmentIds).toEqual(["att_1"]);
    expect(parsed.content).toBe("");
  });

  it("rejects empty content without attachments", () => {
    expect(() => sendMessageInputSchema.parse({ content: "   " })).toThrow();
  });

  it("rejects more than four attachments", () => {
    expect(() =>
      sendMessageInputSchema.parse({
        content: "",
        attachmentIds: ["a", "b", "c", "d", "e"],
      }),
    ).toThrow();
  });
});

describe("messageAttachmentSchema", () => {
  it("validates image attachment metadata", () => {
    const parsed = messageAttachmentSchema.parse({
      id: "att_1",
      kind: "image",
      mimeType: "image/png",
      filename: "context.png",
      sizeBytes: 1200,
      width: 800,
      height: 600,
    });
    expect(parsed.kind).toBe("image");
  });

  it("rejects unsupported image mime types", () => {
    expect(() =>
      messageAttachmentSchema.parse({
        id: "att_1",
        kind: "image",
        mimeType: "image/gif",
        filename: "context.gif",
        sizeBytes: 1200,
      }),
    ).toThrow();
  });
});

describe("messageSchema attachments", () => {
  it("round-trips optional attachments", () => {
    const message = messageSchema.parse({
      id: "m1",
      role: "user",
      content: "",
      status: "done",
      createdAt: "2026-01-01T00:00:00.000Z",
      attachments: [
        {
          id: "att_1",
          kind: "image",
          mimeType: "image/png",
          filename: "context.png",
          sizeBytes: 1200,
        },
      ],
    });
    expect(message.attachments).toHaveLength(1);
  });
});

describe("chatAttachmentUploadResponseSchema", () => {
  it("parses upload response", () => {
    const parsed = chatAttachmentUploadResponseSchema.parse({
      attachment: {
        id: "att_1",
        kind: "image",
        mimeType: "image/jpeg",
        filename: "a.jpg",
        sizeBytes: 10,
      },
    });
    expect(parsed.attachment.id).toBe("att_1");
  });
});

describe("regenerateMessageInputSchema", () => {
  it("accepts empty body", () => {
    const parsed = regenerateMessageInputSchema.parse({});
    expect(parsed.model).toBeUndefined();
  });

  it("accepts model and deskState", () => {
    const parsed = regenerateMessageInputSchema.parse({
      model: "gpt-4o",
      deskState: { screenKey: "chat" },
    });
    expect(parsed.model).toBe("gpt-4o");
  });
});

describe("reasoningChunkSchema", () => {
  it("validates reasoning chunk payload", () => {
    const parsed = reasoningChunkSchema.parse({ text: "pensando…" });
    expect(parsed.text).toBe("pensando…");
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
  it("aceita approved sem result (tools executadas no servidor)", () => {
    const parsed = toolResultInputSchema.parse({
      requestId: "r1",
      approved: true,
    });
    expect(parsed.approved).toBe(true);
    expect(parsed.result).toBeUndefined();
  });

  it("aceita approved com result (tools executadas no cliente)", () => {
    const parsed = toolResultInputSchema.parse({
      requestId: "r1",
      approved: true,
      result: "conteúdo",
    });
    expect(parsed.result).toBe("conteúdo");
  });

  it("allows deny without result", () => {
    const parsed = toolResultInputSchema.parse({
      requestId: "r1",
      approved: false,
    });
    expect(parsed.approved).toBe(false);
  });
});

const baseMessage = {
  id: "m1",
  role: "assistant" as const,
  content: "Resposta",
  status: "done" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("messageSchema citations", () => {
  it("T7.1 parses a message without citations", () => {
    const parsed = messageSchema.parse(baseMessage);
    expect(parsed.content).toBe("Resposta");
    expect(parsed.citations).toBeUndefined();
  });

  it("T7.2 parses citation kinds rule, procedure and document", () => {
    const parsed = messageSchema.parse({
      ...baseMessage,
      citations: [
        { id: "r1", kind: "rule", label: "Regra de reembolso" },
        { id: "p1", kind: "procedure", label: "Cancelar plano" },
        { id: "d1", kind: "document", label: "Política comercial" },
      ],
    });
    expect(parsed.citations?.map((item) => item.kind)).toEqual([
      "rule",
      "procedure",
      "document",
    ]);
  });

  it("T7.3 keeps citations: [] instead of collapsing to undefined", () => {
    const parsed = messageSchema.parse({
      ...baseMessage,
      citations: [],
    });
    expect(parsed.citations).toEqual([]);
    expect(parsed.citations).not.toBeUndefined();
  });

  it("T7.3b unknown kind fails the citations array on messageSchema; SSE parser (7b) strips the item so the rest of the message stays usable", () => {
    expect(messageCitationKindSchema.options).toEqual([
      "rule",
      "procedure",
      "document",
    ]);
    expect(() =>
      messageCitationSchema.parse({
        id: "c1",
        kind: "wiki",
        label: "Página",
      }),
    ).toThrow();
    expect(() =>
      messageSchema.parse({
        ...baseMessage,
        citations: [
          { id: "c1", kind: "wiki", label: "Página" },
          { id: "d1", kind: "document", label: "Política comercial" },
        ],
      }),
    ).toThrow();
    const usable = messageSchema.parse({
      ...baseMessage,
      citations: [{ id: "d1", kind: "document", label: "Política comercial" }],
    });
    expect(usable.content).toBe("Resposta");
    expect(usable.status).toBe("done");
    expect(usable.citations).toEqual([
      { id: "d1", kind: "document", label: "Política comercial" },
    ]);
  });

  it("parses optional captureSummary of up to 3 bullets", () => {
    const parsed = messageSchema.parse({
      ...baseMessage,
      captureSummary: ["pedido", "protocolo", "prazo"],
    });
    expect(parsed.captureSummary).toEqual(["pedido", "protocolo", "prazo"]);
    expect(() =>
      messageSchema.parse({
        ...baseMessage,
        captureSummary: ["a", "b", "c", "d"],
      }),
    ).toThrow();
  });
});

describe("messageArtifactSchema", () => {
  it("aceita artifact de pdf completo", () => {
    const parsed = messageArtifactSchema.parse({
      id: "doc-1",
      kind: "pdf",
      title: "Relatório",
      filename: "relatorio.pdf",
      sizeBytes: 2048,
      pageCount: 3,
    });
    expect(parsed.kind).toBe("pdf");
    expect(parsed.pageCount).toBe(3);
  });

  it("aceita artifact sem pageCount", () => {
    const parsed = messageArtifactSchema.parse({
      id: "doc-1",
      kind: "pdf",
      title: "Relatório",
      filename: "relatorio.pdf",
      sizeBytes: 0,
    });
    expect(parsed.pageCount).toBeUndefined();
  });

  it("rejeita kind desconhecido", () => {
    expect(() =>
      messageArtifactSchema.parse({
        id: "doc-1",
        kind: "docx",
        title: "Relatório",
        filename: "relatorio.docx",
        sizeBytes: 10,
      }),
    ).toThrow();
  });

  it("rejeita pageCount zero", () => {
    expect(() =>
      messageArtifactSchema.parse({
        id: "doc-1",
        kind: "pdf",
        title: "Relatório",
        filename: "relatorio.pdf",
        sizeBytes: 10,
        pageCount: 0,
      }),
    ).toThrow();
  });
});
