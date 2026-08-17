import { afterEach, describe, expect, it } from "vitest";

import {
  buildChatHandoffPayload,
  consumeChatHandoffBuffer,
  decodeChatHandoffAttachment,
  encodeChatHandoffAttachment,
  hasChatHandoffContent,
  markChatHandoffConsumed,
  resetChatHandoffForTests,
  storeChatHandoffBuffer,
  CHAT_HANDOFF_TTL_MS,
  type ChatHandoffPayload,
} from "@/lib/chat/chat-handoff";

afterEach(() => {
  resetChatHandoffForTests();
});

describe("chat-handoff", () => {
  it("roundtrips attachment encode/decode", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "shot.png", {
      type: "image/png",
    });
    const encoded = await encodeChatHandoffAttachment({
      status: "ready",
      file,
      width: 10,
      height: 20,
      sourceLabel: "Recorte",
    });
    expect(encoded).not.toBeNull();
    const decoded = decodeChatHandoffAttachment(encoded!);
    expect(decoded.width).toBe(10);
    expect(decoded.height).toBe(20);
    expect(decoded.sourceLabel).toBe("Recorte");
    expect(decoded.file.name).toBe("shot.png");
    expect(await decoded.file.arrayBuffer()).toEqual(await file.arrayBuffer());
  });

  it("build returns null when empty", async () => {
    expect(
      await buildChatHandoffPayload({
        conversationId: null,
        draftText: "  ",
        pending: null,
      }),
    ).toBeNull();
  });

  it("build includes draft without attachment", async () => {
    const payload = await buildChatHandoffPayload({
      conversationId: "c1",
      draftText: "olá",
      pending: null,
    });
    expect(payload).toMatchObject({
      conversationId: "c1",
      draftText: "olá",
    });
    expect(payload?.attachment).toBeUndefined();
    expect(hasChatHandoffContent(payload!)).toBe(true);
  });

  it("buffer expires after TTL", () => {
    const payload: ChatHandoffPayload = {
      id: "h1",
      conversationId: null,
      draftText: "x",
    };
    storeChatHandoffBuffer(payload);
    expect(consumeChatHandoffBuffer(Date.now() + CHAT_HANDOFF_TTL_MS + 1)).toBeNull();
  });

  it("buffer is one-shot", () => {
    const payload: ChatHandoffPayload = {
      id: "h2",
      conversationId: null,
      draftText: "x",
    };
    storeChatHandoffBuffer(payload);
    expect(consumeChatHandoffBuffer()?.id).toBe("h2");
    expect(consumeChatHandoffBuffer()).toBeNull();
  });

  it("mark consumed prevents double apply from buffer", () => {
    const payload: ChatHandoffPayload = {
      id: "h3",
      conversationId: null,
      draftText: "x",
    };
    storeChatHandoffBuffer(payload);
    markChatHandoffConsumed("h3");
    expect(consumeChatHandoffBuffer()).toBeNull();
  });

  it("encode returns null for non-ready pending", async () => {
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    await expect(
      encodeChatHandoffAttachment({
        status: "capturing",
        file,
        width: 1,
        height: 1,
      }),
    ).resolves.toBeNull();
  });

  it("decode throws on corrupt base64", () => {
    expect(() =>
      decodeChatHandoffAttachment({
        base64: "***",
        mimeType: "image/png",
        filename: "x.png",
        width: 1,
        height: 1,
      }),
    ).toThrow();
  });
});
