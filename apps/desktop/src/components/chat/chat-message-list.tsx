import { useCallback, useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

import { ChatMessageBubble } from "@/components/chat/chat-message";
import type { ChatMessage } from "@/lib/chat/types";

type ChatMessageListProps = {
  messages: ChatMessage[];
  onReply: (message: ChatMessage) => void;
};

const SCROLL_STICK_THRESHOLD_PX = 80;

export function ChatMessageList({ messages, onReply }: ChatMessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

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
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <MessageSquare className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Nova conversa</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie uma mensagem para começar o atendimento com o assistente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="scrollbar-elegant h-full overflow-y-auto overscroll-contain"
      onScroll={updateStickToBottom}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} onReply={onReply} />
        ))}
      </div>
    </div>
  );
}
