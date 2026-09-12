const ACTIVE_CONVERSATION_KEY = "linvo:island-active-conversation";

export type ActiveConversationScope = {
  userId: string;
  workspaceId: string;
};

type StoredActiveConversation = ActiveConversationScope & {
  version: 1;
  conversationId: string;
};

function parseStoredActiveConversation(
  raw: string,
): StoredActiveConversation | null {
  try {
    const value = JSON.parse(raw) as Partial<StoredActiveConversation>;
    if (
      value.version !== 1 ||
      typeof value.userId !== "string" ||
      !value.userId.trim() ||
      typeof value.workspaceId !== "string" ||
      !value.workspaceId.trim() ||
      typeof value.conversationId !== "string" ||
      !value.conversationId.trim()
    ) {
      return null;
    }
    return value as StoredActiveConversation;
  } catch {
    return null;
  }
}

/**
 * Conversa que a ilha estava mostrando.
 *
 * Guardada separada da conversa ativa do painel: as duas janelas podem estar
 * em conversas diferentes, e sobrescrever uma com a outra faria a ilha "pular"
 * de assunto sempre que alguém navegasse no painel.
 *
 * O id vive junto do usuário e workspace que o possuem. As mensagens já são
 * persistidas por conversa em
 * `chat-local-store` (respaldado nos comandos Tauri `chat_save_messages` /
 * `chat_load_messages`), então lembrar o id basta para o `useChat` reconstruir
 * a conversa inteira ao reabrir — é isso que faz a ilha não perder o chat
 * quando é fechada.
 */
export function loadActiveConversationId(
  scope: ActiveConversationScope | null,
): string | null {
  if (!scope) {
    return null;
  }
  try {
    const raw = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    if (!raw) {
      return null;
    }
    const stored = parseStoredActiveConversation(raw);
    if (
      !stored ||
      stored.userId !== scope.userId ||
      stored.workspaceId !== scope.workspaceId
    ) {
      return null;
    }
    return stored.conversationId;
  } catch {
    return null;
  }
}

export function saveActiveConversationId(
  conversationId: string | null,
  scope: ActiveConversationScope | null = null,
): void {
  try {
    if (!conversationId || !scope) {
      localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
      return;
    }
    const stored: StoredActiveConversation = {
      version: 1,
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      conversationId,
    };
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, JSON.stringify(stored));
  } catch {
    return;
  }
}
