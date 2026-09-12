import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Procedure } from "@linvo/shared";

import { ChatPanel } from "@/components/chat/chat-panel";
import { useChat } from "@/hooks/use-chat";
import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";
import { buildConversationTitle } from "@/lib/chat/conversation-title";
import { getStoredWorkspaceId } from "@/lib/workspace/workspace-store";

type IslandChatProps = {
  userId: string;
  disabled?: boolean;
  autoStartCapture?: boolean;
  onAutoCaptureConsumed?: () => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
  resetToken?: number;
};

/**
 * O chat completo dentro da ilha flutuante.
 *
 * Monta o MESMO `useChat` e o MESMO `ChatPanel` da janela grande — não uma
 * versão reduzida. O que existia antes aqui (`useQuickPrompt`) não era um chat
 * menor: era outra coisa, sem histórico nenhum (guardava uma única string de
 * resposta, apagada a cada envio). Recursos como responder, regenerar,
 * aprovação de ferramenta, seletor de modelo, raciocínio e artefatos não
 * estavam "faltando" — não existiam.
 *
 * `useChat` é autônomo: não usa contexto nem router, só recebe
 * `conversationId` e `workspaceId`. É por isso que ele funciona aqui, numa
 * janela que não tem `WorkspaceProvider` nem `ChatConversationsProvider` (os
 * dois vivem no `PanelShell`).
 *
 * A conversa ativa é persistida. As mensagens já eram — `useChat` grava por
 * conversa em `chat-local-store` — então lembrar o id basta para a ilha
 * reabrir exatamente onde parou, em vez de começar do zero a cada abertura.
 */
export function IslandChat({
  userId,
  disabled = false,
  autoStartCapture = false,
  onAutoCaptureConsumed,
  onOpenProcedureChecklist,
  resetToken = 0,
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
  const previousResetTokenRef = useRef(resetToken);
  const previousScopeRef = useRef(conversationScope);

  const handleConversationCreated = useCallback((id: string) => {
    setConversationId(id);
    saveActiveConversationId(id, conversationScope);
  }, [conversationScope]);

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
    onConversationCreated: handleConversationCreated,
    ...(onOpenProcedureChecklist ? { onOpenProcedureChecklist } : {}),
  });

  useEffect(() => {
    if (previousResetTokenRef.current === resetToken) {
      return;
    }
    previousResetTokenRef.current = resetToken;
    stopResponding();
    saveActiveConversationId(null);
    setConversationId(null);
  }, [resetToken, stopResponding]);

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
    setConversationId(loadActiveConversationId(conversationScope));
  }, [conversationScope, stopResponding]);

  /*
   * Título derivado da primeira mensagem do usuário.
   *
   * A janela grande pega o título de `useConversations`, que a ilha não tem.
   * Derivar aqui evita arrastar o provider inteiro para cá só por um texto —
   * e é a mesma regra (`buildConversationTitle`) que o painel aplica ao
   * renomear a conversa, então os dois mostram o mesmo nome.
   */
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
          {...(onOpenProcedureChecklist
            ? { onOpenProcedureChecklist }
            : {})}
        />
      )}
    </div>
  );
}
