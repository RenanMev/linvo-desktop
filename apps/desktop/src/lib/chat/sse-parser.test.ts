import { describe, expect, it } from "vitest";

import { parseSseBlock, parseSsePayload } from "@/lib/chat/sse-parser";

describe("sse-parser", () => {
  it("parses a single SSE block", () => {
    const block = 'event: chunk\ndata: {"text":"Olá"}';

    expect(parseSseBlock(block)).toEqual({
      event: "chunk",
      data: { text: "Olá" },
    });
  });

  it("parses multiple SSE events from a payload", () => {
    const payload = [
      'event: user_message',
      'data: {"id":"u1","role":"user","content":"Oi","status":"done","createdAt":"2026-01-01T00:00:00.000Z"}',
      "",
      'event: chunk',
      'data: {"text":"Olá"}',
      "",
      'event: done',
      'data: {"id":"a1","role":"assistant","content":"Olá","status":"done","createdAt":"2026-01-01T00:00:01.000Z"}',
      "",
    ].join("\n");

    const events = parseSsePayload(payload);

    expect(events).toHaveLength(3);
    expect(events[0]?.event).toBe("user_message");
    expect(events[1]?.event).toBe("chunk");
    expect(events[2]?.event).toBe("done");
  });

  it("returns null for invalid blocks", () => {
    expect(parseSseBlock("invalid")).toBeNull();
  });
});
