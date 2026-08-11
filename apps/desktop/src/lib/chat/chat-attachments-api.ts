import {
  chatAttachmentUploadResponseSchema,
  type MessageAttachment,
} from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authDebug } from "@/lib/auth/auth-debug";
import { authorizedFetch } from "@/lib/auth/http";
import { ChatApiError } from "@/lib/chat/chat-api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const CHAT_AUTH_OPTIONS = { onUnauthorized: "throw" as const };

export type ChatAttachmentSource =
  | "display_capture"
  | "clipboard"
  | "file";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message[0] ?? "Erro inesperado";
    }
    if (typeof body.message === "string") {
      return body.message;
    }
  } catch {
    return "Erro inesperado";
  }
  return "Erro inesperado";
}

export async function uploadChatAttachment(
  conversationId: string,
  file: Blob,
  options?: {
    filename?: string;
    source?: ChatAttachmentSource;
  },
): Promise<MessageAttachment> {
  const path = `/api/conversations/${conversationId}/attachments`;
  authDebug("chat.attachment.upload", { path });

  const form = new FormData();
  form.append("file", file, options?.filename ?? "context.png");
  form.append("kind", "image");
  if (options?.source) {
    form.append("source", options.source);
  }

  let response: Response;
  try {
    response = await authorizedFetch(
      `${API_URL}${path}`,
      {
        method: "POST",
        body: form,
      },
      CHAT_AUTH_OPTIONS,
    );
  } catch (error) {
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ChatApiError(message, response.status);
  }

  const data: unknown = await response.json();
  return chatAttachmentUploadResponseSchema.parse(data).attachment;
}

export async function fetchChatAttachmentBlob(
  conversationId: string,
  attachmentId: string,
): Promise<Blob> {
  const path = `/api/conversations/${conversationId}/attachments/${attachmentId}`;
  let response: Response;
  try {
    response = await authorizedFetch(
      `${API_URL}${path}`,
      { method: "GET" },
      CHAT_AUTH_OPTIONS,
    );
  } catch (error) {
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    throw new ChatApiError(await parseErrorMessage(response), response.status);
  }

  return response.blob();
}
