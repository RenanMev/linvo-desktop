const TITLE_MAX_LENGTH = 50;

export function buildConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "Nova conversa";
  if (normalized.length <= TITLE_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, TITLE_MAX_LENGTH)}…`;
}
