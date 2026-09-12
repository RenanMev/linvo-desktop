import { beforeEach, describe, expect, it, vi } from "vitest";

import * as http from "@/lib/auth/http";
import { streamChatResponse } from "@/lib/chat/chat-api";

const citation = {
  id: "doc-1",
  kind: "document" as const,
  label: "Política comercial",
};

function sseResponse(blocks: string[]): Response {
  return new Response(blocks.map((block) => `${block}\n\n`).join(""), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function drain(generator: AsyncGenerator<string>): Promise<string> {
  let text = "";
  for await (const chunk of generator) {
    text += chunk;
  }
  return text;
}

describe("streamChatResponse citation event", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("T7.4 reports each valid citation emitted during the stream", async () => {
    const procedure = {
      id: "proc-1",
      kind: "procedure" as const,
      label: "Cancelar plano",
    };
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      sseResponse([
        `event: citation\ndata: ${JSON.stringify(citation)}`,
        `event: chunk\ndata: ${JSON.stringify({ text: "pronto" })}`,
        `event: citation\ndata: ${JSON.stringify(procedure)}`,
      ]),
    );
    const onCitation = vi.fn();

    const text = await drain(
      streamChatResponse({
        conversationId: "conv-1",
        content: "como cancelo?",
        onCitation,
      }),
    );

    expect(text).toBe("pronto");
    expect(onCitation).toHaveBeenNthCalledWith(1, citation);
    expect(onCitation).toHaveBeenNthCalledWith(2, procedure);
  });

  it("T7.5 ignores a citation payload that does not match the contract", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      sseResponse([
        `event: citation\ndata: ${JSON.stringify({ id: "c1", kind: "wiki", label: "Página" })}`,
        `event: chunk\ndata: ${JSON.stringify({ text: "ok" })}`,
      ]),
    );
    const onCitation = vi.fn();

    const text = await drain(
      streamChatResponse({
        conversationId: "conv-1",
        content: "como cancelo?",
        onCitation,
      }),
    );

    expect(text).toBe("ok");
    expect(onCitation).not.toHaveBeenCalled();
  });
});

describe("streamChatResponse capture_summary event", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reports a valid capture_summary with 1..3 bullets", async () => {
    const bullets = ["pedido de cancelamento", "protocolo 123", "sem multa"];
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      sseResponse([
        `event: capture_summary\ndata: ${JSON.stringify({ bullets })}`,
        `event: chunk\ndata: ${JSON.stringify({ text: "vi o print" })}`,
      ]),
    );
    const onCaptureSummary = vi.fn();

    const text = await drain(
      streamChatResponse({
        conversationId: "conv-1",
        content: "segue o print",
        onCaptureSummary,
      }),
    );

    expect(text).toBe("vi o print");
    expect(onCaptureSummary).toHaveBeenCalledTimes(1);
    expect(onCaptureSummary).toHaveBeenCalledWith(bullets);
  });

  it("ignores an invalid capture_summary payload", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      sseResponse([
        `event: capture_summary\ndata: ${JSON.stringify({ bullets: ["a", "b", "c", "d"] })}`,
        `event: capture_summary\ndata: ${JSON.stringify({ bullets: [] })}`,
        `event: capture_summary\ndata: ${JSON.stringify({ bullets: [""] })}`,
        `event: capture_summary\ndata: ${JSON.stringify({ text: "não é bullets" })}`,
        `event: chunk\ndata: ${JSON.stringify({ text: "ok" })}`,
      ]),
    );
    const onCaptureSummary = vi.fn();

    const text = await drain(
      streamChatResponse({
        conversationId: "conv-1",
        content: "segue o print",
        onCaptureSummary,
      }),
    );

    expect(text).toBe("ok");
    expect(onCaptureSummary).not.toHaveBeenCalled();
  });
});
