import type {
  ChatAttachment,
  ChatMessage,
  ChatReplyRef,
  ChatRole,
} from "@/lib/chat/types";

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
  if (message.status !== "done") return undefined;
  const trimmed = message.content.trim();
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  if (!trimmed && !hasAttachments) return undefined;

  return {
    id: message.id,
    role: message.role,
    content: trimmed || "Contexto visual",
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
  attachments?: ChatAttachment[],
): ChatMessage {
  return {
    id,
    role: "user",
    content: content.trim(),
    createdAt,
    status: "done",
    replyTo,
    ...(attachments?.length ? { attachments } : {}),
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
    if (artifacts.some((item) => item.id === artifact.id)) return message;
    return { ...message, artifacts: [...artifacts, artifact] };
  });
}

export function appendCitation(
  messages: ChatMessage[],
  id: string,
  citation: NonNullable<ChatMessage["citations"]>[number],
): ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== id) return message;
    const citations = message.citations ?? [];
    if (citations.some((item) => item.id === citation.id)) return message;
    return { ...message, citations: [...citations, citation] };
  });
}

export function setMessageCitations(
  messages: ChatMessage[],
  id: string,
  citations: NonNullable<ChatMessage["citations"]>,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, citations } : message,
  );
}

export function setCaptureSummary(
  messages: ChatMessage[],
  id: string,
  captureSummary: NonNullable<ChatMessage["captureSummary"]>,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? { ...message, captureSummary } : message,
  );
}

export function mergeAssistantDoneMessage(
  mapped: ChatMessage,
  local: ChatMessage,
): ChatMessage {
  return {
    ...mapped,
    citations:
      mapped.citations !== undefined ? mapped.citations : local.citations,
    captureSummary:
      mapped.captureSummary !== undefined
        ? mapped.captureSummary
        : local.captureSummary,
  };
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

export function canSendMessage(
  content: string,
  isResponding: boolean,
  options?: { hasAttachment?: boolean },
): boolean {
  if (isResponding) return false;
  return content.trim().length > 0 || Boolean(options?.hasAttachment);
}

export function mergeAttachmentPreviewUrls(
  serverAttachments: ChatAttachment[] | undefined,
  localAttachments: ChatAttachment[] | undefined,
): ChatAttachment[] | undefined {
  if (!serverAttachments?.length) {
    return localAttachments;
  }
  if (!localAttachments?.length) {
    return serverAttachments;
  }
  return serverAttachments.map((attachment, index) => ({
    ...attachment,
    url: attachment.url ?? localAttachments[index]?.url,
  }));
}

export function createLocalAudioAttachment(input: {
  id?: string;
  file: File;
  transcript?: string;
}): ChatAttachment {
  const type = input.file.type;
  const mimeType =
    type === "audio/ogg" ||
    type === "audio/mpeg" ||
    type === "audio/mp4" ||
    type === "audio/webm" ||
    type === "audio/wav"
      ? type
      : "audio/ogg";

  return {
    id: input.id ?? crypto.randomUUID(),
    kind: "audio",
    mimeType,
    filename: input.file.name,
    sizeBytes: input.file.size,
    ...(input.transcript ? { transcript: input.transcript } : {}),
  };
}

export function createLocalImageAttachment(input: {
  id?: string;
  file: File;
  width: number;
  height: number;
  previewUrl: string;
}): ChatAttachment {
  const mimeType =
    input.file.type === "image/jpeg" ||
    input.file.type === "image/webp" ||
    input.file.type === "image/png"
      ? input.file.type
      : "image/png";

  return {
    id: input.id ?? crypto.randomUUID(),
    kind: "image",
    mimeType,
    filename: input.file.name,
    sizeBytes: input.file.size,
    width: input.width,
    height: input.height,
    url: input.previewUrl,
  };
}
