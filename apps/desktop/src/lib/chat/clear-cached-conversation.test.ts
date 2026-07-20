import { beforeEach, describe, expect, it } from "vitest";

import {
  clearCachedConversation,
  loadCachedConversationMessages,
  loadCachedConversations,
  resetChatLocalStoreForTests,
  saveCachedConversationMessages,
  saveCachedConversations,
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
];

describe("clearCachedConversation", () => {
  beforeEach(() => {
    localStorage.clear();
    resetChatLocalStoreForTests();
  });

  it("removes cached messages for the conversation", async () => {
    saveCachedConversations([
      {
        id: "conv-1",
        title: "Atendimento",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    saveCachedConversationMessages("conv-1", sampleMessages);

    clearCachedConversation("conv-1");

    expect(loadCachedConversationMessages("conv-1")).toEqual([]);
    expect(loadCachedConversations()).toEqual([
      {
        id: "conv-1",
        title: "Atendimento",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(localStorage.getItem("linvo:chat-history:conv-1")).toBeNull();
  });
});
