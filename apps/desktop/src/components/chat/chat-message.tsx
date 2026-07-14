import { Bot, User } from "lucide-react";

import { ChatMessageOptions } from "@/components/chat/chat-message-options";
import { ChatReplyQuote } from "@/components/chat/chat-reply-quote";
import { ChatToolUses } from "@/components/chat/chat-tool-uses";
import { canReplyToMessage } from "@/lib/chat/chat-state";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  onReply: (message: ChatMessage) => void;
};

export function ChatMessageBubble({ message, onReply }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const canReply = canReplyToMessage(message);

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>

      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div className="flex items-start gap-1">
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
              isUser
                ? "rounded-tr-sm bg-primary text-primary-foreground"
                : "rounded-tl-sm bg-muted text-foreground",
            )}
          >
            {message.replyTo && (
              <ChatReplyQuote replyTo={message.replyTo} isUser={isUser} />
            )}
            {message.content || (message.status === "streaming" ? "▍" : "")}
          </div>

          {canReply && (
            <ChatMessageOptions
              onReply={() => onReply(message)}
              align={isUser ? "end" : "start"}
            />
          )}
        </div>

        {message.status === "error" && (
          <span className="text-xs text-destructive">Falha ao gerar resposta.</span>
        )}

        {!isUser && (message.toolUses?.length ?? 0) > 0 && (
          <ChatToolUses
            toolUses={message.toolUses!}
            isStreaming={message.status === "streaming"}
          />
        )}
      </div>
    </div>
  );
}
