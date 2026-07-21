import { useEffect, useState } from "react";
import type { Procedure } from "@linvo/shared";
import { useNavigate, useParams } from "react-router-dom";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ProcedureChecklistPanel } from "@/components/procedure/procedure-checklist-panel";
import { useConversations } from "@/context/chat-conversations-context";
import { useWorkspace } from "@/context/workspace-context";
import { useChat } from "@/hooks/use-chat";
import { buildConversationTitle } from "@/lib/chat/conversation-title";

export function ChatPage() {
  const navigate = useNavigate();
  const { conversationId: routeConversationId } = useParams();
  const { activeWorkspace } = useWorkspace();
  const {
    conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    syncActiveId,
    updateConversationTitle,
    refreshList,
  } = useConversations();
  const [checklistProcedure, setChecklistProcedure] =
    useState<Procedure | null>(null);

  const conversationId = routeConversationId ?? null;
  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const conversationTitle = activeConversation?.title ?? "Nova conversa";

  useEffect(() => {
    syncActiveId(conversationId);
  }, [conversationId, syncActiveId]);

  const {
    messages,
    isResponding,
    isLoadingHistory,
    replyTarget,
    error,
    pendingToolRequest,
    sendMessage,
    startReply,
    cancelReply,
    resolveToolRequest,
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
  const checklistTitle =
    checklistProcedure?.title?.trim() ||
    checklistProcedure?.slug ||
    "Procedure";
  const checklistSlug = checklistProcedure?.slug ?? "";
  const checklistSteps = checklistProcedure?.steps ?? [];

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
        <div className="flex min-h-0 flex-1">
          <ChatPanel
            conversationKey={conversationId}
            conversationTitle={conversationTitle}
            messages={messages}
            isResponding={isResponding}
            replyTarget={replyTarget}
            pendingToolRequest={pendingToolRequest}
            onSend={(content) => void sendMessage(content)}
            onReply={startReply}
            onCancelReply={cancelReply}
            onApproveTool={() => void resolveToolRequest(true)}
            onDenyTool={() => void resolveToolRequest(false)}
            disabled={isResponding || Boolean(pendingToolRequest)}
            workspaceId={activeWorkspace?.id ?? null}
            onOpenProcedureChecklist={setChecklistProcedure}
          />
          {checklistProcedure && checklistSlug ? (
            <ProcedureChecklistPanel
              key={checklistProcedure.id}
              title={checklistTitle}
              slug={checklistSlug}
              steps={checklistSteps}
              onClose={() => setChecklistProcedure(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
