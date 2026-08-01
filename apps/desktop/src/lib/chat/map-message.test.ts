import { describe, expect, it } from "vitest";

import { mapApiMessageToChat, mapApiMessagesToChat } from "@/lib/chat/map-message";

describe("map-message", () => {
  it("maps API message to chat message", () => {
    const mapped = mapApiMessageToChat({
      id: "msg-1",
      role: "assistant",
      content: "Olá",
      status: "done",
      createdAt: "2026-01-01T12:00:00.000Z",
      replyTo: {
        id: "msg-0",
        role: "user",
        content: "Oi",
      },
    });

    expect(mapped).toEqual({
      id: "msg-1",
      role: "assistant",
      content: "Olá",
      status: "done",
      createdAt: new Date("2026-01-01T12:00:00.000Z").getTime(),
      replyTo: {
        id: "msg-0",
        role: "user",
        content: "Oi",
      },
    });
  });

  it("maps message list", () => {
    const mapped = mapApiMessagesToChat([
      {
        id: "msg-1",
        role: "user",
        content: "Oi",
        status: "done",
        createdAt: "2026-01-01T12:00:00.000Z",
      },
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.role).toBe("user");
  });

  it("maps activities and reasoning roundtrip fields", () => {
    const mapped = mapApiMessageToChat({
      id: "msg-2",
      role: "assistant",
      content: "Pronto",
      status: "done",
      createdAt: "2026-01-01T12:00:00.000Z",
      toolUses: [{ name: "search_knowledge", label: "Base de conhecimento" }],
      activities: [
        {
          id: "a1",
          label: "Base de conhecimento",
          status: "done",
          kind: "research",
          detail: "cancelamento",
        },
      ],
      reasoning: "Vou consultar a base.",
    });

    expect(mapped.activities).toEqual([
      {
        id: "a1",
        label: "Base de conhecimento",
        status: "done",
        kind: "research",
        detail: "cancelamento",
      },
    ]);
    expect(mapped.reasoning).toBe("Vou consultar a base.");
    expect(mapped.toolUses).toEqual([
      { name: "search_knowledge", label: "Base de conhecimento" },
    ]);
  });

  it("keeps artifacts so the card survives a conversation reload", () => {
    const mapped = mapApiMessageToChat({
      id: "msg-3",
      role: "assistant",
      content: "Segue o PDF",
      status: "done",
      createdAt: "2026-01-01T12:00:00.000Z",
      artifacts: [
        {
          id: "doc-1",
          kind: "pdf",
          title: "Relatório",
          filename: "relatorio.pdf",
          sizeBytes: 2048,
          pageCount: 2,
        },
      ],
    });

    expect(mapped.artifacts).toEqual([
      {
        id: "doc-1",
        kind: "pdf",
        title: "Relatório",
        filename: "relatorio.pdf",
        sizeBytes: 2048,
        pageCount: 2,
      },
    ]);
  });
});
