import { useCallback, useMemo, useState } from "react";
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
  /** Bloqueia o envio quando a API está fora ou a sessão expirou. */
  disabled?: boolean;
  /** Ver `autoStartCapture` em `ChatInput` — vem do botão "Recorte" da pílula. */
  autoStartCapture?: boolean;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
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
  disabled = false,
  autoStartCapture = false,
  onOpenProcedureChecklist,
}: IslandChatProps) {
  const [conversationId, setConversationId] = useState<string | null>(() =>
    loadActiveConversationId(),
  );
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Lido uma vez por render em vez de vir de contexto: a ilha não tem
  // `WorkspaceProvider`, e o id é a mesma fonte que o painel usa.
  const workspaceId = getStoredWorkspaceId();

  const handleConversationCreated = useCallback((id: string) => {
    setConversationId(id);
    saveActiveConversationId(id);
  }, []);

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
    workspaceId,
    model: selectedModel,
    onConversationCreated: handleConversationCreated,
    ...(onOpenProcedureChecklist ? { onOpenProcedureChecklist } : {}),
  });

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
          onReply={startReply}
          onRegenerate={(message) => void regenerateMessage(message.id)}
          onCancelReply={cancelReply}
          onApproveTool={() => void resolveToolRequest(true)}
          onDenyTool={() => void resolveToolRequest(false)}
          disabled={disabled || isResponding || Boolean(pendingToolRequest)}
          workspaceId={workspaceId}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          // A ilha é a janela `main`: a captura precisa se esconder dela, não
          // do painel, e devolver o recorte para cá.
          captureWindowLabel="main"
          autoStartCapture={autoStartCapture}
          // A ilha tem cabeçalho próprio; a barra de título do chat viraria
          // uma segunda faixa repetindo "Nova conversa" logo abaixo.
          showToolbar={false}
          {...(onOpenProcedureChecklist
            ? { onOpenProcedureChecklist }
            : {})}
        />
      )}
    </div>
  );
}
