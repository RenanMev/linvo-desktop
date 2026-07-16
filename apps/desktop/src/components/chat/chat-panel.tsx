import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatToolbar } from "@/components/chat/chat-toolbar";
import type { ChatMessage, ChatReplyRef, ChatToolRequest } from "@/lib/chat/types";

type ChatPanelProps = {
  conversationKey?: string | null;
  conversationTitle: string;
  messages: ChatMessage[];
  isResponding: boolean;
  replyTarget: ChatReplyRef | null;
  pendingToolRequest?: ChatToolRequest | null;
  onSend: (content: string) => void;
  onReply: (message: ChatMessage) => void;
  onCancelReply: () => void;
  onApproveTool?: () => void;
  onDenyTool?: () => void;
  disabled?: boolean;
};

export function ChatPanel({
  conversationKey,
  conversationTitle,
  messages,
  isResponding,
  replyTarget,
  pendingToolRequest = null,
  onSend,
  onReply,
  onCancelReply,
  onApproveTool,
  onDenyTool,
  disabled = false,
}: ChatPanelProps) {
  const inputDisabled = disabled || Boolean(pendingToolRequest);

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatToolbar title={conversationTitle} />
      <div className="min-h-0 flex-1">
        <ChatMessageList
          key={conversationKey ?? "draft"}
          messages={messages}
          onReply={onReply}
          onSuggestion={onSend}
          suggestionsDisabled={inputDisabled || isResponding}
          pendingToolRequest={pendingToolRequest}
          onApproveTool={onApproveTool}
          onDenyTool={onDenyTool}
          toolActionDisabled={isResponding}
        />
      </div>
      <ChatInput
        onSend={onSend}
        isResponding={isResponding}
        replyTarget={replyTarget}
        onCancelReply={onCancelReply}
        disabled={inputDisabled}
      />
    </main>
  );
}
