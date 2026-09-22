import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Procedure } from "@linvo/shared";

import { ChatPanel } from "@/components/chat/chat-panel";
import type { AssistContinueRequest } from "@/lib/assist-handoff";
import { useChat } from "@/hooks/use-chat";
import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";
import { buildConversationTitle } from "@/lib/chat/conversation-title";
import {
  buildDeskState,
  type ChecklistByConversation,
} from "@/lib/chat/desk-state";
import {
  listenChecklistClosed,
  listenChecklistProgress,
  openChecklist,
} from "@/lib/checklist-window";
import { getStoredWorkspaceId } from "@/lib/workspace/workspace-store";

type IslandChatProps = {
  userId: string;
  disabled?: boolean;
  autoStartCapture?: boolean;
  onAutoCaptureConsumed?: () => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
  resetToken?: number;
  continueRequest?: AssistContinueRequest | null;
};

export function IslandChat({
  userId,
  disabled = false,
  autoStartCapture = false,
  onAutoCaptureConsumed,
  onOpenProcedureChecklist,
  resetToken = 0,
  continueRequest = null,
}: IslandChatProps) {
  const workspaceId = getStoredWorkspaceId();
  const conversationScope = useMemo(
    () => (workspaceId ? { userId, workspaceId } : null),
    [userId, workspaceId],
  );
  const [conversationId, setConversationId] = useState<string | null>(() =>
    loadActiveConversationId(conversationScope),
  );
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [checklistByConversation, setChecklistByConversation] =
    useState<ChecklistByConversation>({});
  const previousResetTokenRef = useRef(resetToken);
  const previousContinueTokenRef = useRef(continueRequest?.token ?? 0);
  const previousScopeRef = useRef(conversationScope);

  const handleConversationCreated = useCallback((id: string) => {
    setConversationId(id);
    saveActiveConversationId(id, conversationScope);
  }, [conversationScope]);

  const handleOpenProcedureChecklist = useCallback(
    (procedure: Procedure) => {
      if (!conversationId) {
        onOpenProcedureChecklist?.(procedure);
        return;
      }
      const progress = checklistByConversation[conversationId]?.progress ?? {
        completedStepIndexes: [],
        currentStepIndex: 0,
      };
      setChecklistByConversation((current) => ({
        ...current,
        [conversationId]: {
          procedure,
          progress: current[conversationId]?.progress ?? progress,
        },
      }));
      void openChecklist({
        conversationId,
        procedure,
        progress,
      });
      onOpenProcedureChecklist?.(procedure);
    },
    [checklistByConversation, conversationId, onOpenProcedureChecklist],
  );

  const deskState = useMemo(
    () =>
      buildDeskState({
        conversationId,
        checklistByConversation,
      }),
    [checklistByConversation, conversationId],
  );

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
    stopResponding,
  } = useChat({
    conversationId,
    workspaceId,
    model: selectedModel,
    deskState,
    onConversationCreated: handleConversationCreated,
    onOpenProcedureChecklist: handleOpenProcedureChecklist,
  });

  useEffect(() => {
    if (previousResetTokenRef.current === resetToken) {
      return;
    }
    previousResetTokenRef.current = resetToken;
    stopResponding();
    saveActiveConversationId(null);
    setConversationId(null);
    setChecklistByConversation({});
  }, [resetToken, stopResponding]);

  useEffect(() => {
    if (
      !continueRequest ||
      previousContinueTokenRef.current === continueRequest.token
    ) {
      return;
    }
    previousContinueTokenRef.current = continueRequest.token;
    if (continueRequest.conversationId === conversationId) {
      return;
    }
    stopResponding();
    saveActiveConversationId(continueRequest.conversationId, conversationScope);
    setConversationId(continueRequest.conversationId);
  }, [continueRequest, conversationId, conversationScope, stopResponding]);

  useEffect(() => {
    const previousScope = previousScopeRef.current;
    if (
      previousScope?.userId === conversationScope?.userId &&
      previousScope?.workspaceId === conversationScope?.workspaceId
    ) {
      return;
    }
    previousScopeRef.current = conversationScope;
    stopResponding();
    setChecklistByConversation({});
    setConversationId(loadActiveConversationId(conversationScope));
  }, [conversationScope, stopResponding]);

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenClosed: (() => void) | undefined;

    void listenChecklistProgress((event) => {
      setChecklistByConversation((current) => {
        const entry = current[event.conversationId];
        if (!entry) {
          return current;
        }
        return {
          ...current,
          [event.conversationId]: {
            ...entry,
            progress: event.progress,
          },
        };
      });
    }).then((dispose) => {
      unlistenProgress = dispose;
    });

    void listenChecklistClosed((event) => {
      setChecklistByConversation((current) => {
        if (!current[event.conversationId]) {
          return current;
        }
        const next = { ...current };
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
  }, []);

  const conversationTitle = useMemo(() => {
    const firstUserMessage = messages.find(
      (message) => message.role === "user" && message.content.trim(),
    );
    return firstUserMessage
      ? buildConversationTitle(firstUserMessage.content)
      : "Nova conversa";
  }, [messages]);

  const isRestoringHistory =
    Boolean(conversationId) && isLoadingHistory && messages.length === 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {error ? (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {isRestoringHistory ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Retomando conversa...
        </div>
      ) : (
        <ChatPanel
          conversationKey={conversationId}
          conversationTitle={conversationTitle}
          messages={messages}
          isResponding={isResponding}
          replyTarget={replyTarget}
          pendingToolRequest={pendingToolRequest}
          onSend={(content, options) => void sendMessage(content, options)}
          onStop={stopResponding}
          onReply={startReply}
          onRegenerate={(message) => void regenerateMessage(message.id)}
          onCancelReply={cancelReply}
          onApproveTool={() => void resolveToolRequest(true)}
          onDenyTool={() => void resolveToolRequest(false)}
          disabled={disabled || Boolean(pendingToolRequest)}
          workspaceId={workspaceId}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          captureWindowLabel="main"
          autoStartCapture={autoStartCapture}
          {...(onAutoCaptureConsumed ? { onAutoCaptureConsumed } : {})}
          showToolbar={false}
          variant="assist"
          onOpenProcedureChecklist={handleOpenProcedureChecklist}
        />
      )}
    </div>
  );
}
