import { useCallback, useEffect, useRef } from "react";

import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { ChatMessageBubble } from "@/components/chat/chat-message";
import type { ChatMessage, ChatToolRequest } from "@/lib/chat/types";

type ChatMessageListProps = {
  messages: ChatMessage[];
  onReply: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
  regenerateDisabled?: boolean;
  onSuggestion?: (prompt: string) => void;
  suggestionsDisabled?: boolean;
  pendingToolRequest?: ChatToolRequest | null;
  onApproveTool?: () => void;
  onDenyTool?: () => void;
  toolActionDisabled?: boolean;
};

const SCROLL_STICK_THRESHOLD_PX = 80;

export function ChatMessageList({
  messages,
  onReply,
  onRegenerate,
  regenerateDisabled = false,
  onSuggestion,
  suggestionsDisabled = false,
  pendingToolRequest = null,
  onApproveTool,
  onDenyTool,
  toolActionDisabled = false,
}: ChatMessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const lastRegenerableId = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        (message.status === "done" || message.status === "error"),
    )?.id;

  const updateStickToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= SCROLL_STICK_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useEffect(() => {
    if (!stickToBottomRef.current) {
      return;
    }

    const isStreaming = messages.some((message) => message.status === "streaming");
    scrollToBottom(isStreaming ? "auto" : "smooth");
  }, [messages, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <ChatEmptyState
        onSuggestion={onSuggestion ?? (() => undefined)}
        disabled={suggestionsDisabled}
      />
    );
  }

  return (
    <div
      ref={viewportRef}
      className="scrollbar-elegant h-full overflow-y-auto overscroll-contain"
      onScroll={updateStickToBottom}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-6 py-8">
        {messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            onReply={onReply}
            canRegenerate={Boolean(onRegenerate) && message.id === lastRegenerableId}
            onRegenerate={onRegenerate}
            regenerateDisabled={regenerateDisabled}
            pendingToolRequest={pendingToolRequest}
            onApproveTool={onApproveTool}
            onDenyTool={onDenyTool}
            toolActionDisabled={toolActionDisabled}
          />
        ))}
      </div>
    </div>
  );
}
