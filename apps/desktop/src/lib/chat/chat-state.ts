import type { ChatMessage, ChatReplyRef, ChatRole } from "@/lib/chat/types";

export function replyAuthorLabel(role: ChatRole): string {
  switch (role) {
    case "user":
      return "Você";
    case "assistant":
      return "Assistente";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export function truncateReplyContent(content: string, maxLength = 120): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

export function createReplyRef(message: ChatMessage): ChatReplyRef | undefined {
  if (message.status !== "done" || !message.content.trim()) return undefined;

  return {
    id: message.id,
    role: message.role,
    content: message.content.trim(),
  };
}

export function canReplyToMessage(message: ChatMessage): boolean {
  return createReplyRef(message) !== undefined;
}

export function createUserMessage(
  id: string,
  content: string,
  createdAt: number,
  replyTo?: ChatReplyRef,
): ChatMessage {
  return {
    id,
    role: "user",
    content: content.trim(),
    createdAt,
    status: "done",
    replyTo,
  };
}

export function createAssistantPlaceholder(id: string, createdAt: number): ChatMessage {
  return {
    id,
    role: "assistant",
    content: "",
    createdAt,
    status: "streaming",
  };
}

export function appendToMessage(
  messages: ChatMessage[],
  id: string,
  chunk: string,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, content: message.content + chunk } : message,
  );
}

export function finalizeMessage(
  messages: ChatMessage[],
  id: string,
  status: ChatMessage["status"] = "done",
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, status } : message,
  );
}

export function appendToolUse(
  messages: ChatMessage[],
  id: string,
  tool: NonNullable<ChatMessage["toolUses"]>[number],
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id
      ? { ...message, toolUses: [...(message.toolUses ?? []), tool] }
      : message,
  );
}

export function appendArtifact(
  messages: ChatMessage[],
  id: string,
  artifact: NonNullable<ChatMessage["artifacts"]>[number],
): ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== id) return message;
    const artifacts = message.artifacts ?? [];
    // O mesmo turno pode ser retomado depois de uma pausa e reemitir o card já
    // recebido; o id do documento é único, então serve de chave.
    if (artifacts.some((item) => item.id === artifact.id)) return message;
    return { ...message, artifacts: [...artifacts, artifact] };
  });
}

export function upsertActivity(
  messages: ChatMessage[],
  id: string,
  activity: NonNullable<ChatMessage["activities"]>[number],
): ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== id) return message;
    const activities = [...(message.activities ?? [])];
    const index = activities.findIndex((item) => item.id === activity.id);
    if (index >= 0) {
      activities[index] = activity;
    } else {
      activities.push(activity);
    }
    return { ...message, activities };
  });
}

export function appendReasoning(
  messages: ChatMessage[],
  id: string,
  chunk: string,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id
      ? { ...message, reasoning: `${message.reasoning ?? ""}${chunk}` }
      : message,
  );
}

export function setMessageModel(
  messages: ChatMessage[],
  id: string,
  model: string,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, model } : message,
  );
}

export function canSendMessage(content: string, isResponding: boolean): boolean {
  return content.trim().length > 0 && !isResponding;
}
