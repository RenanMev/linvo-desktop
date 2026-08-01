import { beforeEach, describe, expect, it, vi } from "vitest";

import * as http from "@/lib/auth/http";
import { streamChatResponse } from "@/lib/chat/chat-api";

const pdf = {
  id: "doc-1",
  kind: "pdf" as const,
  title: "Relatório",
  filename: "relatorio.pdf",
  sizeBytes: 2048,
  pageCount: 2,
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

describe("streamChatResponse artifact event", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reports each artifact emitted during the stream", async () => {
    const second = { ...pdf, id: "doc-2", filename: "anexo.pdf" };
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      sseResponse([
        `event: artifact\ndata: ${JSON.stringify(pdf)}`,
        `event: chunk\ndata: ${JSON.stringify({ text: "pronto" })}`,
        `event: artifact\ndata: ${JSON.stringify(second)}`,
      ]),
    );
    const onArtifact = vi.fn();

    const text = await drain(
      streamChatResponse({
        conversationId: "conv-1",
        content: "gere dois PDFs",
        onArtifact,
      }),
    );

    expect(text).toBe("pronto");
    expect(onArtifact).toHaveBeenNthCalledWith(1, pdf);
    expect(onArtifact).toHaveBeenNthCalledWith(2, second);
  });

  it("ignores an artifact payload that does not match the contract", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      sseResponse([
        `event: artifact\ndata: ${JSON.stringify({ id: "doc-1", kind: "docx" })}`,
        `event: chunk\ndata: ${JSON.stringify({ text: "ok" })}`,
      ]),
    );
    const onArtifact = vi.fn();

    const text = await drain(
      streamChatResponse({
        conversationId: "conv-1",
        content: "gere um PDF",
        onArtifact,
      }),
    );

    expect(text).toBe("ok");
    expect(onArtifact).not.toHaveBeenCalled();
  });
});
