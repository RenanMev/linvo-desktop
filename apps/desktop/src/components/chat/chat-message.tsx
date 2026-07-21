import { Bot, User } from "lucide-react";

import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { ChatMessageOptions } from "@/components/chat/chat-message-options";
import { ChatReasoningPanel } from "@/components/chat/chat-reasoning-panel";
import { ChatReplyQuote } from "@/components/chat/chat-reply-quote";
import { ChatToolApproval } from "@/components/chat/chat-tool-approval";
import { ChatToolUses } from "@/components/chat/chat-tool-uses";
import { canReplyToMessage } from "@/lib/chat/chat-state";
import type { ChatMessage, ChatToolRequest } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  onReply: (message: ChatMessage) => void;
  pendingToolRequest?: ChatToolRequest | null;
  onApproveTool?: () => void;
  onDenyTool?: () => void;
  toolActionDisabled?: boolean;
};

export function ChatMessageBubble({
  message,
  onReply,
  pendingToolRequest = null,
  onApproveTool,
  onDenyTool,
  toolActionDisabled = false,
}: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const canReply = canReplyToMessage(message);
  const isStreaming =
    message.status === "streaming" || message.status === "awaiting_tool";
  const showApproval =
    !isUser &&
    message.status === "awaiting_tool" &&
    pendingToolRequest != null &&
    onApproveTool != null &&
    onDenyTool != null;
  const hasTools = !isUser && (message.toolUses?.length ?? 0) > 0;
  const hasReasoningPanel =
    !isUser &&
    ((message.activities?.length ?? 0) > 0 ||
      Boolean(message.reasoning?.trim()) ||
      Boolean(message.model) ||
      hasTools ||
      (isStreaming && !message.content));

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
          "flex max-w-[min(75%,42rem)] flex-col gap-1.5",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div className="flex w-full items-start gap-1">
          <div
            className={cn(
              "min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "rounded-tr-sm bg-primary text-primary-foreground whitespace-pre-wrap"
                : "rounded-tl-sm bg-muted text-foreground",
            )}
          >
            {message.replyTo && (
              <ChatReplyQuote replyTo={message.replyTo} isUser={isUser} />
            )}

            {hasReasoningPanel && (
              <ChatReasoningPanel
                activities={message.activities}
                reasoning={message.reasoning}
                toolUses={message.toolUses}
                model={message.model}
                isStreaming={isStreaming}
              />
            )}

            {message.content ? (
              isUser ? (
                message.content
              ) : (
                <ChatMarkdown content={message.content} />
              )
            ) : isStreaming && !hasReasoningPanel ? (
              <span className="text-muted-foreground">
                {message.status === "awaiting_tool"
                  ? "Aguardando aprovação..."
                  : "Pensando..."}
              </span>
            ) : null}
          </div>

          {canReply && (
            <ChatMessageOptions
              onReply={() => onReply(message)}
              align={isUser ? "end" : "start"}
            />
          )}
        </div>

        {message.status === "error" && (
          <span className="text-xs text-destructive">
            Falha ao gerar resposta.
          </span>
        )}

        {showApproval && (
          <ChatToolApproval
            request={pendingToolRequest}
            disabled={toolActionDisabled}
            onApprove={onApproveTool}
            onDeny={onDenyTool}
          />
        )}

        {!isUser && hasTools && !hasReasoningPanel && (
          <ChatToolUses
            toolUses={message.toolUses!}
            isStreaming={isStreaming}
          />
        )}
      </div>
    </div>
  );
}
