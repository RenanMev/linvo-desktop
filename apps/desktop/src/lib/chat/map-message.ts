import type { Message } from "@linvo/shared";

import type { ChatMessage } from "@/lib/chat/types";

export function mapApiMessageToChat(message: Message): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt).getTime(),
    status: message.status,
    replyTo: message.replyTo,
    toolUses: message.toolUses,
    activities: message.activities,
    reasoning: message.reasoning,
    model: message.model,
  };
}

export function mapApiMessagesToChat(messages: Message[]): ChatMessage[] {
  return messages.map(mapApiMessageToChat);
}
