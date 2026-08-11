import type { Conversation } from "@linvo/shared";
import { invoke, isTauri } from "@tauri-apps/api/core";

import type { ChatMessage } from "@/lib/chat/types";

const CONVERSATIONS_KEY = "linvo:chat-conversations";
const historyKey = (conversationId: string) =>
  `linvo:chat-history:${conversationId}`;

let memoryConversations: Conversation[] = [];
const memoryMessages = new Map<string, ChatMessage[]>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function readJson<T>(raw: string | null | undefined): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const message = value as ChatMessage;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.createdAt === "number" &&
    (message.status === "streaming" ||
      message.status === "done" ||
      message.status === "error" ||
      message.status === "awaiting_tool") &&
    (message.toolUses === undefined ||
      (Array.isArray(message.toolUses) &&
        message.toolUses.every(
          (tool) =>
            typeof tool === "object" &&
            tool !== null &&
            typeof tool.name === "string" &&
            typeof tool.label === "string",
        )))
  );
}

function parseMessages(raw: string | null | undefined): ChatMessage[] {
  const parsed = readJson<unknown[]>(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isChatMessage);
}

function parseConversations(raw: string | null | undefined): Conversation[] {
  const parsed = readJson<Conversation[]>(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function loadLegacyLocalStorageConversations(): Conversation[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  return parseConversations(localStorage.getItem(CONVERSATIONS_KEY));
}

function loadLegacyLocalStorageMessages(conversationId: string): ChatMessage[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  return parseMessages(localStorage.getItem(historyKey(conversationId)));
}

function clearLegacyLocalStorage(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("linvo:chat-history:") || key === CONVERSATIONS_KEY) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

async function persistConversationsToDisk(
  conversations: Conversation[],
): Promise<void> {
  if (isTauri()) {
    await invoke("chat_save_conversations", {
      payload: JSON.stringify(conversations),
    });
    return;
  }

  if (typeof localStorage === "undefined") {
    return;
  }

  if (conversations.length === 0) {
    localStorage.removeItem(CONVERSATIONS_KEY);
    return;
  }

  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

async function persistMessagesToDisk(
  conversationId: string,
  messages: ChatMessage[],
): Promise<void> {
  const payload = JSON.stringify(messages);

  if (isTauri()) {
    await invoke("chat_save_messages", {
      conversationId,
      payload,
    });
    return;
  }

  if (typeof localStorage === "undefined") {
    return;
  }

  if (messages.length === 0) {
    localStorage.removeItem(historyKey(conversationId));
    return;
  }

  localStorage.setItem(historyKey(conversationId), payload);
}

async function migrateLegacyLocalStorageToDisk(): Promise<void> {
  const legacyConversations = loadLegacyLocalStorageConversations();
  if (legacyConversations.length > 0) {
    await persistConversationsToDisk(legacyConversations);
  }

  if (typeof localStorage === "undefined") {
    return;
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("linvo:chat-history:")) {
      continue;
    }

    const conversationId = key.slice("linvo:chat-history:".length);
    const messages = loadLegacyLocalStorageMessages(conversationId);
    if (messages.length > 0) {
      memoryMessages.set(conversationId, messages);
      await persistMessagesToDisk(conversationId, messages);
    }
  }

  clearLegacyLocalStorage();
}

export function sanitizeMessagesForCache(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter(
      (message) =>
        message.status !== "streaming" && message.status !== "awaiting_tool",
    )
    .map((message) => ({
      ...message,
      attachments: message.attachments?.map((attachment) => {
        if (!attachment.url?.startsWith("blob:")) {
          return attachment;
        }
        const persistentAttachment = { ...attachment };
        delete persistentAttachment.url;
        return persistentAttachment;
      }),
    }));
}

export async function hydrateChatLocalStore(): Promise<void> {
  if (hydrated) {
    return;
  }

  if (hydratePromise) {
    await hydratePromise;
    return;
  }

  hydratePromise = (async () => {
    if (isTauri()) {
      try {
        const raw = await invoke<string | null>("chat_load_conversations");
        memoryConversations = parseConversations(raw ?? undefined);
      } catch {
        memoryConversations = [];
      }

      const legacyConversations = loadLegacyLocalStorageConversations();
      if (memoryConversations.length === 0 && legacyConversations.length > 0) {
        memoryConversations = legacyConversations;
      }

      await migrateLegacyLocalStorageToDisk();
    } else {
      memoryConversations = loadLegacyLocalStorageConversations();
    }

    hydrated = true;
  })();

  await hydratePromise;
}

export async function loadCachedConversationMessagesFromStore(
  conversationId: string,
): Promise<ChatMessage[]> {
  await hydrateChatLocalStore();

  const cachedInMemory = memoryMessages.get(conversationId);
  if (cachedInMemory) {
    return cachedInMemory;
  }

  if (isTauri()) {
    try {
      const raw = await invoke<string | null>("chat_load_messages", {
        conversationId,
      });
      const messages = parseMessages(raw ?? undefined);
      memoryMessages.set(conversationId, messages);
      return messages;
    } catch {
      return [];
    }
  }

  const legacyMessages = loadLegacyLocalStorageMessages(conversationId);
  memoryMessages.set(conversationId, legacyMessages);
  return legacyMessages;
}

export function loadCachedConversationMessages(
  conversationId: string,
): ChatMessage[] {
  const cachedInMemory = memoryMessages.get(conversationId);
  if (cachedInMemory) {
    return cachedInMemory;
  }

  return loadLegacyLocalStorageMessages(conversationId);
}

export function saveCachedConversationMessages(
  conversationId: string,
  messages: ChatMessage[],
): void {
  const sanitized = sanitizeMessagesForCache(messages);
  memoryMessages.set(conversationId, sanitized);
  void persistMessagesToDisk(conversationId, sanitized);
}

export function clearCachedConversation(conversationId: string): void {
  memoryMessages.delete(conversationId);
  void persistMessagesToDisk(conversationId, []);
}

export function loadCachedConversations(): Conversation[] {
  if (hydrated || memoryConversations.length > 0) {
    return memoryConversations;
  }

  return loadLegacyLocalStorageConversations();
}

export function saveCachedConversations(conversations: Conversation[]): void {
  memoryConversations = conversations;
  void persistConversationsToDisk(conversations);
}

export async function clearChatLocalCache(): Promise<void> {
  memoryConversations = [];
  memoryMessages.clear();
  hydrated = false;
  hydratePromise = null;
  clearLegacyLocalStorage();

  if (isTauri()) {
    try {
      await invoke("chat_clear_cache");
    } catch {
      /* ignore */
    }
  }
}

export function resetChatLocalStoreForTests(): void {
  memoryConversations = [];
  memoryMessages.clear();
  hydrated = false;
  hydratePromise = null;
}
