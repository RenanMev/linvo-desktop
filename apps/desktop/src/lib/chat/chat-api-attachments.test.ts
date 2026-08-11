import { beforeEach, describe, expect, it, vi } from "vitest";

import * as http from "@/lib/auth/http";
import { streamChatResponse } from "@/lib/chat/chat-api";

describe("streamChatResponse attachments", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes attachment ids with an attachment-only message", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    for await (const _chunk of streamChatResponse({
      conversationId: "conv-1",
      content: "",
      attachmentIds: ["att_1"],
    })) {
      throw new Error("unexpected chunk");
    }

    const init = fetchSpy.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      content: "",
      attachmentIds: ["att_1"],
    });
  });

  it("omits attachmentIds from regular text messages", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    for await (const _chunk of streamChatResponse({
      conversationId: "conv-1",
      content: "olá",
    })) {
      throw new Error("unexpected chunk");
    }

    const init = fetchSpy.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({ content: "olá" });
  });
});
