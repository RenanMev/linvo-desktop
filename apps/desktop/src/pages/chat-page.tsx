import { useCallback, useEffect, useMemo, useState } from "react";
import type { Procedure } from "@linvo/shared";
import { useNavigate, useParams } from "react-router";

import { ChatPanel } from "@/components/chat/chat-panel";
import { useConversations } from "@/context/chat-conversations-context";
import { useWorkspace } from "@/context/workspace-context";
import { useChat } from "@/hooks/use-chat";
import { buildConversationTitle } from "@/lib/chat/conversation-title";
import {
  buildDeskState,
  type ChecklistByConversation,
  type ChecklistProgress,
} from "@/lib/chat/desk-state";
import {
  type ChatHandoffPayload,
  consumeChatHandoffBuffer,
  listenChatHandoff,
} from "@/lib/chat/chat-handoff";
import {
  closeChecklist,
  listenChecklistClosed,
  listenChecklistProgress,
  openChecklist,
} from "@/lib/checklist-window";

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
  const [checklistByConversation, setChecklistByConversation] =
    useState<ChecklistByConversation>({});
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [composerHandoff, setComposerHandoff] =
    useState<ChatHandoffPayload | null>(null);

  const conversationId = routeConversationId ?? null;
  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const conversationTitle = activeConversation?.title ?? "Nova conversa";

  useEffect(() => {
    syncActiveId(conversationId);
  }, [conversationId, syncActiveId]);

  useEffect(() => {
    const buffered = consumeChatHandoffBuffer();
    if (buffered) {
      setComposerHandoff(buffered);
    }
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenChatHandoff((payload) => {
      if (!disposed) {
        setComposerHandoff(payload);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const deskState = useMemo(
    () =>
      buildDeskState({
        conversationId,
        checklistByConversation,
      }),
    [conversationId, checklistByConversation],
  );

  const applyProgress = useCallback(
    (targetConversationId: string, progress: ChecklistProgress) => {
      setChecklistByConversation((prev) => {
        const entry = prev[targetConversationId];
        if (!entry) {
          return prev;
        }
        const same =
          entry.progress.currentStepIndex === progress.currentStepIndex &&
          entry.progress.completedStepIndexes.length ===
            progress.completedStepIndexes.length &&
          entry.progress.completedStepIndexes.every(
            (value, index) => value === progress.completedStepIndexes[index],
          );
        if (same) {
          return prev;
        }
        return {
          ...prev,
          [targetConversationId]: {
            ...entry,
            progress,
          },
        };
      });
    },
    [],
  );

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenClosed: (() => void) | undefined;

    void listenChecklistProgress((event) => {
      applyProgress(event.conversationId, event.progress);
    }).then((dispose) => {
      unlistenProgress = dispose;
    });

    void listenChecklistClosed((event) => {
      setChecklistByConversation((prev) => {
        if (!prev[event.conversationId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[event.conversationId];
        return next;
      });
    }).then((dispose) => {
      unlistenClosed = dispose;
    });

    return () => {
      unlistenProgress?.();
      unlistenClosed?.();
    };
  }, [applyProgress]);

  function setChecklistForActive(procedure: Procedure | null) {
    if (!conversationId) {
      return;
    }

    if (!procedure) {
      setChecklistByConversation((prev) => {
        if (!prev[conversationId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      void closeChecklist();
      return;
    }

    const progress: ChecklistProgress = checklistByConversation[conversationId]
      ?.progress ?? {
      completedStepIndexes: [],
      currentStepIndex: 0,
    };

    setChecklistByConversation((prev) => ({
      ...prev,
      [conversationId]: {
        procedure,
        progress: prev[conversationId]?.progress ?? progress,
      },
    }));

    void openChecklist({
      conversationId,
      procedure,
      progress,
    });
  }

  const {
    messages,
    isResponding,
    isLoadingHistory,
    replyTarget,
    error,
    pendingToolRequest,
    sendMessage,
    regenerateMessage,
    startReply,
    cancelReply,
    resolveToolRequest,
  } = useChat({
    conversationId,
    workspaceId: activeWorkspace?.id ?? null,
    deskState,
    model: selectedModel,
    onConversationCreated: (id) => {
      void refreshList();
      navigate(`/chat/${id}`, { replace: true });
    },
    onConversationTitleChange: (id, content) => {
      updateConversationTitle(id, buildConversationTitle(content));
    },
    onOpenProcedureChecklist: setChecklistForActive,
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
        <div className="border-b border-hairline px-4 py-2 text-xs text-muted-foreground">
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
            onSend={(content, options) => void sendMessage(content, options)}
            onReply={startReply}
            onRegenerate={(message) => void regenerateMessage(message.id)}
            onCancelReply={cancelReply}
            onApproveTool={() => void resolveToolRequest(true)}
            onDenyTool={() => void resolveToolRequest(false)}
            disabled={isResponding || Boolean(pendingToolRequest)}
            workspaceId={activeWorkspace?.id ?? null}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onOpenProcedureChecklist={setChecklistForActive}
            composerHandoff={composerHandoff}
            onComposerHandoffConsumed={() => setComposerHandoff(null)}
          />
        </div>
      )}
    </div>
  );
}
