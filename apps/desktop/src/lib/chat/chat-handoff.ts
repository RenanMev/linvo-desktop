import { emitTo, listen } from "@tauri-apps/api/event";

export const CHAT_HANDOFF_EVENT = "panel://chat-handoff";
export const CHAT_HANDOFF_TTL_MS = 2_000;

const PANEL_LABEL = "panel";

export type ChatHandoffAttachment = {
  base64: string;
  mimeType: string;
  filename: string;
  width: number;
  height: number;
  sourceLabel?: string;
};

export type ChatHandoffPayload = {
  id: string;
  conversationId: string | null;
  draftText: string;
  attachment?: ChatHandoffAttachment;
};

type PendingAttachmentLike = {
  status: string;
  file: File;
  width: number;
  height: number;
  sourceLabel?: string;
};

let buffer: ChatHandoffPayload | null = null;
let bufferStoredAt = 0;
let lastConsumedId: string | null = null;

export function resetChatHandoffForTests(): void {
  buffer = null;
  bufferStoredAt = 0;
  lastConsumedId = null;
}

export function hasChatHandoffContent(payload: {
  draftText: string;
  attachment?: ChatHandoffAttachment;
}): boolean {
  return Boolean(payload.draftText.trim()) || Boolean(payload.attachment);
}

export async function encodeChatHandoffAttachment(
  pending: PendingAttachmentLike,
): Promise<ChatHandoffAttachment | null> {
  if (pending.status !== "ready") {
    return null;
  }
  try {
    const bufferBytes = await pending.file.arrayBuffer();
    const bytes = new Uint8Array(bufferBytes);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return {
      base64: btoa(binary),
      mimeType: pending.file.type || "image/png",
      filename: pending.file.name || "context.png",
      width: pending.width,
      height: pending.height,
      ...(pending.sourceLabel ? { sourceLabel: pending.sourceLabel } : {}),
    };
  } catch {
    return null;
  }
}

export function decodeChatHandoffAttachment(
  attachment: ChatHandoffAttachment,
): { file: File; width: number; height: number; sourceLabel?: string } {
  const binary = atob(attachment.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const file = new File([bytes], attachment.filename, {
    type: attachment.mimeType || "image/png",
  });
  return {
    file,
    width: attachment.width,
    height: attachment.height,
    ...(attachment.sourceLabel ? { sourceLabel: attachment.sourceLabel } : {}),
  };
}

export async function buildChatHandoffPayload(input: {
  conversationId: string | null;
  draftText: string;
  pending?: PendingAttachmentLike | null;
}): Promise<ChatHandoffPayload | null> {
  const draftText = input.draftText;
  const attachment = input.pending
    ? await encodeChatHandoffAttachment(input.pending)
    : undefined;
  const payload: ChatHandoffPayload = {
    id: crypto.randomUUID(),
    conversationId: input.conversationId,
    draftText,
    ...(attachment ? { attachment } : {}),
  };
  if (!hasChatHandoffContent(payload)) {
    return null;
  }
  return payload;
}

export function storeChatHandoffBuffer(payload: ChatHandoffPayload): void {
  buffer = payload;
  bufferStoredAt = Date.now();
}

export function consumeChatHandoffBuffer(
  now = Date.now(),
): ChatHandoffPayload | null {
  if (!buffer) {
    return null;
  }
  if (now - bufferStoredAt > CHAT_HANDOFF_TTL_MS) {
    buffer = null;
    return null;
  }
  if (lastConsumedId === buffer.id) {
    buffer = null;
    return null;
  }
  const next = buffer;
  buffer = null;
  lastConsumedId = next.id;
  return next;
}

export function markChatHandoffConsumed(id: string): void {
  lastConsumedId = id;
  if (buffer?.id === id) {
    buffer = null;
  }
}

export async function emitChatHandoff(
  payload: ChatHandoffPayload,
): Promise<void> {
  storeChatHandoffBuffer(payload);
  await emitTo(PANEL_LABEL, CHAT_HANDOFF_EVENT, payload);
}

export async function listenChatHandoff(
  handler: (payload: ChatHandoffPayload) => void,
): Promise<() => void> {
  const unlisten = await listen<ChatHandoffPayload>(
    CHAT_HANDOFF_EVENT,
    (event) => {
      markChatHandoffConsumed(event.payload.id);
      handler(event.payload);
    },
  );
  return unlisten;
}
