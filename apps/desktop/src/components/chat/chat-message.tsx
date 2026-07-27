import { Bot, RefreshCw, User } from "lucide-react";

import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { ChatMessageOptions } from "@/components/chat/chat-message-options";
import { ChatReasoningPanel } from "@/components/chat/chat-reasoning-panel";
import { ChatReplyQuote } from "@/components/chat/chat-reply-quote";
import { ChatToolApproval } from "@/components/chat/chat-tool-approval";
import { ChatToolUses } from "@/components/chat/chat-tool-uses";
import { Button } from "@/components/ui/button";
import { canReplyToMessage } from "@/lib/chat/chat-state";
import type { ChatMessage, ChatToolRequest } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  onReply: (message: ChatMessage) => void;
  canRegenerate?: boolean;
  onRegenerate?: (message: ChatMessage) => void;
  regenerateDisabled?: boolean;
  pendingToolRequest?: ChatToolRequest | null;
  onApproveTool?: () => void;
  onDenyTool?: () => void;
  toolActionDisabled?: boolean;
};

export function ChatMessageBubble({
  message,
  onReply,
  canRegenerate = false,
  onRegenerate,
  regenerateDisabled = false,
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
  const showRegenerate =
    canRegenerate && onRegenerate != null && !isUser && !isStreaming;
  const idleStreamingOnly =
    !isUser &&
    isStreaming &&
    !message.content &&
    (message.activities?.length ?? 0) === 0 &&
    !message.reasoning?.trim() &&
    !hasTools &&
    !message.model;

  return (
    <div
      className={cn(
        "group flex gap-3.5",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full border",
          isUser
            ? "border-transparent bg-accent-active text-accent-active-foreground shadow-pill"
            : "border-hairline bg-surface-raise-1 text-foreground/50 shadow-inner-light",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>

      <div
        className={cn(
          "flex min-w-0 flex-col gap-2",
          isUser ? "max-w-[min(75%,34rem)] items-end" : "w-full max-w-3xl items-start",
        )}
      >
        <div className="flex w-full items-start gap-1">
          {idleStreamingOnly ? (
            <div className="min-w-0 py-1">
              <ChatReasoningPanel
                activities={message.activities}
                reasoning={message.reasoning}
                toolUses={message.toolUses}
                model={message.model}
                isStreaming={isStreaming}
              />
            </div>
          ) : (
            <div
              className={cn(
                "min-w-0",
                isUser
                  ? "rounded-premium rounded-tr-sm bg-accent-active px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-accent-active-foreground shadow-pill"
                  : "w-full py-0.5 text-foreground/95",
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
                  <ChatMarkdown content={message.content} editorial />
                )
              ) : isStreaming && !hasReasoningPanel ? (
                <span className="text-muted-foreground">
                  {message.status === "awaiting_tool"
                    ? "Aguardando aprovação..."
                    : "Pensando..."}
                </span>
              ) : null}
            </div>
          )}

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

        {showRegenerate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            disabled={regenerateDisabled}
            title="Regenerar"
            onClick={() => onRegenerate(message)}
          >
            <RefreshCw className="size-3.5" />
            Regenerar
          </Button>
        ) : null}

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
