const ACTIVE_CONVERSATION_KEY = "linvo:island-active-conversation";

/**
 * Conversa que a ilha estava mostrando.
 *
 * Guardada separada da conversa ativa do painel: as duas janelas podem estar
 * em conversas diferentes, e sobrescrever uma com a outra faria a ilha "pular"
 * de assunto sempre que alguém navegasse no painel.
 *
 * Só o id vive aqui. As mensagens já são persistidas por conversa em
 * `chat-local-store` (respaldado nos comandos Tauri `chat_save_messages` /
 * `chat_load_messages`), então lembrar o id basta para o `useChat` reconstruir
 * a conversa inteira ao reabrir — é isso que faz a ilha não perder o chat
 * quando é fechada.
 */
export function loadActiveConversationId(): string | null {
  try {
    const value = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function saveActiveConversationId(conversationId: string | null): void {
  try {
    if (!conversationId) {
      localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
  } catch {
    return;
  }
}
