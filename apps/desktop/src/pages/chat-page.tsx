import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ChatPanel } from "@/components/chat/chat-panel";
import { useConversations } from "@/context/chat-conversations-context";
import { useChat } from "@/hooks/use-chat";
import { buildConversationTitle } from "@/lib/chat/conversation-title";

export function ChatPage() {
  const navigate = useNavigate();
  const { conversationId: routeConversationId } = useParams();
  const {
    isLoading: isLoadingConversations,
    error: conversationsError,
    syncActiveId,
    updateConversationTitle,
    refreshList,
  } = useConversations();

  const conversationId = routeConversationId ?? null;

  useEffect(() => {
    syncActiveId(conversationId);
  }, [conversationId, syncActiveId]);

  const {
    messages,
    isResponding,
    isLoadingHistory,
    replyTarget,
    error,
    sendMessage,
    startReply,
    cancelReply,
  } = useChat({
    conversationId,
    onConversationCreated: (id) => {
      void refreshList();
      navigate(`/chat/${id}`, { replace: true });
    },
    onConversationTitleChange: (id, content) => {
      updateConversationTitle(id, buildConversationTitle(content));
    },
  });

  const isLoadingHistoryForConversation =
    Boolean(conversationId) && isLoadingHistory && messages.length === 0;

  const bannerError = error ?? conversationsError;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {bannerError ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {bannerError}
        </div>
      ) : null}
      {isLoadingConversations && messages.length === 0 ? (
        <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
          Carregando conversas...
        </div>
      ) : null}
      {isLoadingHistoryForConversation ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Carregando conversa...
        </div>
      ) : (
        <ChatPanel
          conversationKey={conversationId}
          messages={messages}
          isResponding={isResponding}
          replyTarget={replyTarget}
          onSend={(content) => void sendMessage(content)}
          onReply={startReply}
          onCancelReply={cancelReply}
          disabled={isResponding}
        />
      )}
    </div>
  );
}
