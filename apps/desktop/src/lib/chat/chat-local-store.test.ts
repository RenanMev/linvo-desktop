import { describe, expect, it, beforeEach } from "vitest";

import {
  loadCachedConversationMessages,
  loadCachedConversationMessagesFromStore,
  loadCachedConversations,
  resetChatLocalStoreForTests,
  saveCachedConversationMessages,
  saveCachedConversations,
  sanitizeMessagesForCache,
} from "@/lib/chat/chat-local-store";
import type { ChatMessage } from "@/lib/chat/types";

const sampleMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "Olá",
    createdAt: 1,
    status: "done",
  },
  {
    id: "m2",
    role: "assistant",
    content: "Como posso ajudar?",
    createdAt: 2,
    status: "streaming",
  },
];

describe("chat-local-store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetChatLocalStoreForTests();
  });

  it("removes streaming messages before saving", () => {
    expect(sanitizeMessagesForCache(sampleMessages)).toEqual([sampleMessages[0]]);
  });

  it("removes ephemeral blob URLs while preserving server URLs", () => {
    const messages: ChatMessage[] = [
      {
        ...sampleMessages[0]!,
        attachments: [
          {
            id: "local",
            kind: "image",
            mimeType: "image/png",
            filename: "local.png",
            sizeBytes: 10,
            url: "blob:local-preview",
          },
          {
            id: "server",
            kind: "image",
            mimeType: "image/webp",
            filename: "server.webp",
            sizeBytes: 20,
            url: "https://cdn.example.com/server.webp",
          },
        ],
      },
    ];

    expect(sanitizeMessagesForCache(messages)[0]?.attachments).toEqual([
      {
        id: "local",
        kind: "image",
        mimeType: "image/png",
        filename: "local.png",
        sizeBytes: 10,
      },
      {
        id: "server",
        kind: "image",
        mimeType: "image/webp",
        filename: "server.webp",
        sizeBytes: 20,
        url: "https://cdn.example.com/server.webp",
      },
    ]);
  });

  it("round-trips conversation messages", async () => {
    saveCachedConversationMessages("conv-1", sampleMessages);

    expect(loadCachedConversationMessages("conv-1")).toEqual([sampleMessages[0]]);
    await expect(
      loadCachedConversationMessagesFromStore("conv-1"),
    ).resolves.toEqual([sampleMessages[0]]);
  });

  it("round-trips conversations list", async () => {
    const conversations = [
      {
        id: "conv-1",
        title: "Atendimento",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    saveCachedConversations(conversations);
    expect(loadCachedConversations()).toEqual(conversations);
  });
});
