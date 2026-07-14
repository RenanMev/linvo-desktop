import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import type { ChatMessage, ChatReplyRef } from "@/lib/chat/types";

type ChatPanelProps = {
  conversationKey?: string | null;
  messages: ChatMessage[];
  isResponding: boolean;
  replyTarget: ChatReplyRef | null;
  onSend: (content: string) => void;
  onReply: (message: ChatMessage) => void;
  onCancelReply: () => void;
  disabled?: boolean;
};

export function ChatPanel({
  conversationKey,
  messages,
  isResponding,
  replyTarget,
  onSend,
  onReply,
  onCancelReply,
  disabled = false,
}: ChatPanelProps) {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <ChatMessageList
          key={conversationKey ?? "draft"}
          messages={messages}
          onReply={onReply}
        />
      </div>
      <ChatInput
        onSend={onSend}
        isResponding={isResponding}
        replyTarget={replyTarget}
        onCancelReply={onCancelReply}
        disabled={disabled}
      />
    </main>
  );
}
