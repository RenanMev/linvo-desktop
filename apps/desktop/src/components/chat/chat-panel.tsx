import type { ReactNode } from "react";
import type { Procedure } from "@linvo/shared";

import {
  ChatInput,
  type ChatSendOptions,
} from "@/components/chat/chat-input";
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
  onSend?: (content: string, options?: ChatSendOptions) => void;
  onReply?: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
  onCancelReply?: () => void;
  onApproveTool?: () => void;
  onDenyTool?: () => void;
  disabled?: boolean;
  workspaceId?: string | null;
  selectedModel?: string | null;
  onModelChange?: (modelId: string | null) => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
  onOpenProcedureAction?: (slug: string) => Promise<void> | void;
  /** Janela que hospeda o chat — ver `captureWindowLabel` em `ChatInput`. */
  captureWindowLabel?: string;
  /** Ver `autoStartCapture` em `ChatInput`. */
  autoStartCapture?: boolean;
  onAutoCaptureConsumed?: () => void;
  /**
   * Mostra a barra com título da conversa e modelo.
   *
   * Desligada na ilha: ela já tem cabeçalho próprio, e as duas empilhadas
   * davam duas faixas de título — a de cima com o workspace, a de baixo
   * repetindo "Nova conversa".
   */
  showToolbar?: boolean;
  onStop?: () => void;
  variant?: "assist";
  /**
   * Histórico: só leitura. Sem composer, responder, regenerar ou sugestões —
   * quem conversa é a ilha. `footer` ocupa o lugar do composer.
   */
  readOnly?: boolean;
  footer?: ReactNode;
};

export function ChatPanel({
  conversationKey,
  conversationTitle,
  messages,
  isResponding,
  replyTarget,
  pendingToolRequest = null,
  onSend = () => undefined,
  onReply,
  onRegenerate,
  onCancelReply = () => undefined,
  onApproveTool,
  onDenyTool,
  disabled = false,
  workspaceId = null,
  selectedModel = null,
  onModelChange,
  onOpenProcedureChecklist,
  onOpenProcedureAction,
  captureWindowLabel,
  autoStartCapture,
  onAutoCaptureConsumed,
  showToolbar = true,
  onStop,
  variant,
  readOnly = false,
  footer,
}: ChatPanelProps) {
  const inputDisabled = disabled || Boolean(pendingToolRequest);
  const activeModel =
    [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.model)?.model ??
    selectedModel;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {showToolbar ? (
        <ChatToolbar
          title={conversationTitle}
          model={activeModel}
          isResponding={isResponding}
        />
      ) : null}
      <div className="min-h-0 flex-1">
        <ChatMessageList
          key={conversationKey ?? "draft"}
          messages={messages}
          onReply={readOnly ? undefined : onReply}
          onRegenerate={readOnly ? undefined : onRegenerate}
          regenerateDisabled={isResponding || Boolean(pendingToolRequest)}
          onSuggestion={readOnly ? undefined : (prompt) => onSend(prompt)}
          suggestionsDisabled={readOnly || inputDisabled || isResponding}
          pendingToolRequest={pendingToolRequest}
          onApproveTool={onApproveTool}
          onDenyTool={onDenyTool}
          toolActionDisabled={isResponding}
          conversationId={conversationKey}
          workspaceId={workspaceId}
          variant={variant}
          onOpenProcedureAction={onOpenProcedureAction}
        />
      </div>
      {readOnly ? (
        footer
      ) : (
        <ChatInput
          key={conversationKey ?? "draft"}
          onSend={onSend}
          isResponding={isResponding}
          onStop={onStop}
          replyTarget={replyTarget}
          onCancelReply={onCancelReply}
          disabled={inputDisabled}
          workspaceId={workspaceId}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          onOpenProcedureChecklist={onOpenProcedureChecklist}
          {...(captureWindowLabel ? { captureWindowLabel } : {})}
          {...(autoStartCapture ? { autoStartCapture } : {})}
          {...(onAutoCaptureConsumed ? { onAutoCaptureConsumed } : {})}
        />
      )}
    </main>
  );
}
