import { useState } from "react";
import { Bot, Check, ClipboardList, Copy, RefreshCw, User } from "lucide-react";

import { CaptureSummary } from "@/components/chat/capture-summary";
import { ChatArtifactCard } from "@/components/chat/chat-artifact-card";
import { AudioAttachmentChip } from "@/components/chat/audio-attachment-chip";
import { ChatAttachmentImage } from "@/components/chat/chat-attachment-image";
import { ChatCitations } from "@/components/chat/chat-citations";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { ChatMessageOptions } from "@/components/chat/chat-message-options";
import { ChatReasoningPanel } from "@/components/chat/chat-reasoning-panel";
import { ChatReplyQuote } from "@/components/chat/chat-reply-quote";
import { ChatToolApproval } from "@/components/chat/chat-tool-approval";
import { ChatToolUses } from "@/components/chat/chat-tool-uses";
import { Button } from "@/components/ui/button";
import { canReplyToMessage } from "@/lib/chat/chat-state";
import { writeClipboardText } from "@/lib/clipboard";
import type { ChatMessage, ChatToolRequest } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  onReply?: (message: ChatMessage) => void;
  canRegenerate?: boolean;
  onRegenerate?: (message: ChatMessage) => void;
  regenerateDisabled?: boolean;
  pendingToolRequest?: ChatToolRequest | null;
  onApproveTool?: () => void;
  onDenyTool?: () => void;
  toolActionDisabled?: boolean;
  conversationId?: string | null;
  workspaceId?: string | null;
  variant?: "assist";
  showAssistCopy?: boolean;
  onOpenProcedureAction?: (slug: string) => Promise<void> | void;
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
  conversationId = null,
  workspaceId = null,
  variant,
  showAssistCopy = false,
  onOpenProcedureAction,
}: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isUser = message.role === "user";
  const canReply = onReply != null && canReplyToMessage(message);
  const isStreaming =
    message.status === "streaming" || message.status === "awaiting_tool";
  const showApproval =
    !isUser &&
    message.status === "awaiting_tool" &&
    pendingToolRequest != null &&
    onApproveTool != null &&
    onDenyTool != null;
  const hasTools = !isUser && (message.toolUses?.length ?? 0) > 0;
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  const hasReasoningPanel =
    !isUser &&
    ((message.activities?.length ?? 0) > 0 ||
      Boolean(message.reasoning?.trim()) ||
      Boolean(message.model) ||
      hasTools ||
      (isStreaming && !message.content));
  const showRegenerate =
    canRegenerate && onRegenerate != null && !isUser && !isStreaming;
  const showCopy =
    variant === "assist" &&
    showAssistCopy &&
    !isUser &&
    message.status === "done" &&
    message.content.trim().length > 0;
  const nextAction =
    !isUser && message.status === "done" ? message.nextAction : undefined;
  const canShowNextAction =
    nextAction?.type === "copy" ||
    (nextAction?.type === "open_procedure" && onOpenProcedureAction != null);
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

              {hasAttachments ? (
                <div
                  className={cn("flex flex-col gap-2", message.content && "mb-2")}
                >
                  {message.attachments?.map((attachment) =>
                    attachment.kind === "audio" ? (
                      <AudioAttachmentChip
                        key={attachment.id}
                        filename={attachment.filename}
                        sizeBytes={attachment.sizeBytes}
                        {...(attachment.transcript
                          ? { transcript: attachment.transcript }
                          : {})}
                      />
                    ) : (
                      <ChatAttachmentImage
                        key={attachment.id}
                        attachment={attachment}
                        conversationId={conversationId}
                      />
                    ),
                  )}
                </div>
              ) : null}

              {!isUser ? (
                <CaptureSummary bullets={message.captureSummary} />
              ) : null}

              {canShowNextAction && nextAction ? (
                <div className="mb-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5 px-2.5 text-xs"
                    disabled={isExecutingAction}
                    onClick={() => {
                      setActionError(null);
                      if (nextAction.type === "copy") {
                        void writeClipboardText(nextAction.text).then((ok) => {
                          if (ok) {
                            setCopied(true);
                          } else {
                            setActionError("NÃ£o foi possÃ­vel copiar o texto.");
                          }
                        });
                        return;
                      }

                      setIsExecutingAction(true);
                      Promise.resolve(onOpenProcedureAction?.(nextAction.slug))
                        .catch(() => {
                          setActionError("NÃ£o foi possÃ­vel abrir o procedimento.");
                        })
                        .finally(() => {
                          setIsExecutingAction(false);
                        });
                    }}
                  >
                    {nextAction.type === "copy" ? (
                      copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />
                    ) : (
                      <ClipboardList className="size-3.5" />
                    )}
                    {nextAction.type === "copy" && copied
                      ? "Copiado"
                      : nextAction.label}
                  </Button>
                </div>
              ) : null}

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

              {!isUser ? (
                <ChatCitations
                  citations={message.citations}
                  workspaceId={workspaceId}
                />
              ) : null}

              {actionError ? (
                <p className="mt-2 text-xs text-destructive" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
          )}

          {canReply && onReply && (
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

        {showCopy ? (
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => {
              void writeClipboardText(message.content).then((ok) => {
                if (ok) {
                  setCopied(true);
                }
              });
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        ) : null}

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

        {!isUser &&
          message.artifacts?.map((artifact) => (
            <ChatArtifactCard key={artifact.id} artifact={artifact} />
          ))}
      </div>
    </div>
  );
}
