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
  onSend: (content: string, options?: ChatSendOptions) => void;
  onReply: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
  onCancelReply: () => void;
  onApproveTool?: () => void;
  onDenyTool?: () => void;
  disabled?: boolean;
  workspaceId?: string | null;
  selectedModel?: string | null;
  onModelChange?: (modelId: string | null) => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
  /** Janela que hospeda o chat — ver `captureWindowLabel` em `ChatInput`. */
  captureWindowLabel?: string;
  /** Ver `autoStartCapture` em `ChatInput`. */
  autoStartCapture?: boolean;
  /**
   * Mostra a barra com título da conversa e modelo.
   *
   * Desligada na ilha: ela já tem cabeçalho próprio, e as duas empilhadas
   * davam duas faixas de título — a de cima com o workspace, a de baixo
   * repetindo "Nova conversa".
   */
  showToolbar?: boolean;
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
  onRegenerate,
  onCancelReply,
  onApproveTool,
  onDenyTool,
  disabled = false,
  workspaceId = null,
  selectedModel = null,
  onModelChange,
  onOpenProcedureChecklist,
  captureWindowLabel,
  autoStartCapture,
  showToolbar = true,
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
          onReply={onReply}
          onRegenerate={onRegenerate}
          regenerateDisabled={isResponding || Boolean(pendingToolRequest)}
          onSuggestion={(prompt) => onSend(prompt)}
          suggestionsDisabled={inputDisabled || isResponding}
          pendingToolRequest={pendingToolRequest}
          onApproveTool={onApproveTool}
          onDenyTool={onDenyTool}
          toolActionDisabled={isResponding}
          conversationId={conversationKey}
        />
      </div>
      <ChatInput
        key={conversationKey ?? "draft"}
        onSend={onSend}
        isResponding={isResponding}
        replyTarget={replyTarget}
        onCancelReply={onCancelReply}
        disabled={inputDisabled}
        workspaceId={workspaceId}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        onOpenProcedureChecklist={onOpenProcedureChecklist}
        {...(captureWindowLabel ? { captureWindowLabel } : {})}
        {...(autoStartCapture ? { autoStartCapture } : {})}
      />
    </main>
  );
}
