import {
  conversationListSchema,
  conversationSchema,
  messageActivitySchema,
  messageListSchema,
  messageToolUseSchema,
  modelInfoSchema,
  reasoningChunkSchema,
  toolRequestSchema,
  type Conversation,
  type DeskState,
  type Message,
  type MessageActivity,
  type MessageToolUse,
  type ToolRequest,
} from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authDebug } from "@/lib/auth/auth-debug";
import { authorizedFetch } from "@/lib/auth/http";
import { parseSseBlock } from "@/lib/chat/sse-parser";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const CHAT_AUTH_OPTIONS = { onUnauthorized: "throw" as const };

export class ChatApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
  }
}

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

async function request<T>(
  path: string,
  init?: RequestInit,
  parser?: (data: unknown) => T,
): Promise<T> {
  authDebug("chat.request", { path });
  let response: Response;

  try {
    response = await authorizedFetch(
      `${API_URL}${path}`,
      {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init?.headers,
        },
      },
      CHAT_AUTH_OPTIONS,
    );
  } catch (error) {
    authDebug("chat.error", {
      path,
      reason: error instanceof Error ? error.name : "unknown",
    });
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    authDebug("chat.error", { path, status: response.status, message });
    throw new ChatApiError(message, response.status);
  }

  const data = await response.json();
  return parser ? parser(data) : (data as T);
}

export async function listConversations(): Promise<Conversation[]> {
  const data = await request("/api/conversations", undefined, (payload) =>
    conversationListSchema.parse(payload),
  );
  return data.conversations;
}

export async function createConversation(): Promise<Conversation> {
  const data = await request(
    "/api/conversations",
    { method: "POST" },
    (payload) => {
      const parsed = payload as { conversation: Conversation };
      return { conversation: conversationSchema.parse(parsed.conversation) };
    },
  );
  return data.conversation;
}

export async function getConversation(id: string): Promise<Conversation> {
  const data = await request(`/api/conversations/${id}`, undefined, (payload) => {
    const parsed = payload as { conversation: Conversation };
    return { conversation: conversationSchema.parse(parsed.conversation) };
  });
  return data.conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  const path = `/api/conversations/${id}`;
  authDebug("chat.request", { path, method: "DELETE" });
  let response: Response;

  try {
    response = await authorizedFetch(
      `${API_URL}${path}`,
      { method: "DELETE" },
      CHAT_AUTH_OPTIONS,
    );
  } catch (error) {
    authDebug("chat.error", {
      path,
      reason: error instanceof Error ? error.name : "unknown",
    });
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    authDebug("chat.error", { path, status: response.status, message });
    throw new ChatApiError(message, response.status);
  }
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const data = await request(
    `/api/conversations/${conversationId}/messages`,
    undefined,
    (payload) => messageListSchema.parse(payload),
  );
  return data.messages;
}

type StreamHandlers = {
  onUserMessage?: (message: Message) => void;
  onToolUsed?: (tool: MessageToolUse) => void;
  onToolRequest?: (request: ToolRequest) => void;
  onActivity?: (activity: MessageActivity) => void;
  onReasoningChunk?: (text: string) => void;
  onModel?: (model: string) => void;
  onAssistantDone?: (message: Message) => void;
};

async function* consumeSseStream(
  response: Response,
  handlers: StreamHandlers,
): AsyncGenerator<string> {
  if (!response.body) {
    throw new ChatApiError("Resposta vazia do servidor", 500);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (!parsed) continue;

      switch (parsed.event) {
        case "user_message":
          handlers.onUserMessage?.(parsed.data as Message);
          break;
        case "chunk": {
          const chunk = parsed.data as { text?: string };
          if (chunk.text) yield chunk.text;
          break;
        }
        case "tool_used": {
          const toolResult = messageToolUseSchema.safeParse(parsed.data);
          if (toolResult.success) {
            handlers.onToolUsed?.(toolResult.data);
          }
          break;
        }
        case "tool_request": {
          const toolRequest = toolRequestSchema.safeParse(parsed.data);
          if (toolRequest.success) {
            handlers.onToolRequest?.(toolRequest.data);
          }
          break;
        }
        case "activity": {
          const activity = messageActivitySchema.safeParse(parsed.data);
          if (activity.success) {
            handlers.onActivity?.(activity.data);
          }
          break;
        }
        case "reasoning_chunk": {
          const chunk = reasoningChunkSchema.safeParse(parsed.data);
          if (chunk.success) {
            handlers.onReasoningChunk?.(chunk.data.text);
          }
          break;
        }
        case "model": {
          const info = modelInfoSchema.safeParse(parsed.data);
          if (info.success) {
            handlers.onModel?.(info.data.model);
          }
          break;
        }
        case "done":
          handlers.onAssistantDone?.(parsed.data as Message);
          break;
        case "error": {
          const error = parsed.data as { message?: string };
          throw new ChatApiError(error.message ?? "Erro ao gerar resposta", 500);
        }
        default:
          break;
      }
    }
  }
}

export type StreamChatOptions = {
  conversationId: string;
  content: string;
  replyToMessageId?: string;
  deskState?: DeskState;
  model?: string;
  signal?: AbortSignal;
} & StreamHandlers;

export async function* streamChatResponse(
  options: StreamChatOptions,
): AsyncGenerator<string> {
  const {
    conversationId,
    content,
    replyToMessageId,
    deskState,
    model,
    signal,
    ...handlers
  } = options;

  const path = `/api/conversations/${conversationId}/messages`;
  authDebug("chat.request", { path, stream: true });
  let response: Response;

  try {
    response = await authorizedFetch(
      `${API_URL}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          content,
          replyToMessageId,
          deskState,
          model,
        }),
        signal,
      },
      CHAT_AUTH_OPTIONS,
    );
  } catch (error) {
    authDebug("chat.error", {
      path,
      reason: error instanceof Error ? error.name : "unknown",
    });
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    authDebug("chat.error", { path, status: response.status, message });
    throw new ChatApiError(message, response.status);
  }

  yield* consumeSseStream(response, handlers);
}

export type SubmitToolResultOptions = {
  conversationId: string;
  requestId: string;
  approved: boolean;
  result?: string;
  deskState?: DeskState;
  model?: string;
  signal?: AbortSignal;
} & StreamHandlers;

export async function* submitToolResult(
  options: SubmitToolResultOptions,
): AsyncGenerator<string> {
  const {
    conversationId,
    requestId,
    approved,
    result,
    deskState,
    model,
    signal,
    ...handlers
  } = options;

  const path = `/api/conversations/${conversationId}/tool-results`;
  authDebug("chat.request", { path, stream: true });
  let response: Response;

  try {
    response = await authorizedFetch(
      `${API_URL}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          requestId,
          approved,
          result,
          deskState,
          model,
        }),
        signal,
      },
      CHAT_AUTH_OPTIONS,
    );
  } catch (error) {
    authDebug("chat.error", {
      path,
      reason: error instanceof Error ? error.name : "unknown",
    });
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    authDebug("chat.error", { path, status: response.status, message });
    throw new ChatApiError(message, response.status);
  }

  yield* consumeSseStream(response, handlers);
}
