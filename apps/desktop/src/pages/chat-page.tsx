import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { MessageSquareText } from "lucide-react";

import { ChatPanel } from "@/components/chat/chat-panel";
import type { PanelOutletContext } from "@/components/panel/panel-shell";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/context/chat-conversations-context";
import { useWorkspace } from "@/context/workspace-context";
import { useChat } from "@/hooks/use-chat";
import {
  assistContinueRejectMessage,
  continueInAssist,
  listenAssistContinueResult,
} from "@/lib/assist-handoff";
import { getStoredWorkspaceId } from "@/lib/workspace/workspace-store";

/*
 * /chat e /chat/:id são o Histórico.
 *
 * O painel não conversa mais: a ilha é o chat live (stream, parar, anexos,
 * checklist). Aqui só se lê o que já aconteceu e, se quiser retomar, manda
 * para a ilha — não existe composer nem janela de checklist saindo daqui.
 */
export function ChatPage() {
  const { conversationId: routeConversationId } = useParams();
  const { session } = useOutletContext<PanelOutletContext>();
  const { activeWorkspace } = useWorkspace();
  const {
    conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    syncActiveId,
  } = useConversations();
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const conversationId = routeConversationId ?? null;
  const workspaceId = activeWorkspace?.id ?? null;
  /*
   * O contexto pode ainda não ter carregado quando o usuário clica; o id
   * gravado cobre esse intervalo. Sem escopo nenhum, `saveActiveConversationId`
   * REMOVERIA a chave em vez de gravar — daí o botão ficar desabilitado.
   */
  const handoffWorkspaceId = workspaceId ?? getStoredWorkspaceId();
  const canContinue = Boolean(conversationId && handoffWorkspaceId);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listenAssistContinueResult((result) => {
      if (result.conversationId !== conversationId) {
        return;
      }
      setHandoffError(
        result.accepted ? null : assistContinueRejectMessage(result.reason),
      );
    }).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [conversationId]);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const conversationTitle = activeConversation?.title ?? "Histórico";

  useEffect(() => {
    syncActiveId(conversationId);
  }, [conversationId, syncActiveId]);

  const { messages, isResponding, isLoadingHistory, replyTarget, error } =
    useChat({
      conversationId,
      workspaceId,
    });

  const isLoadingHistoryForConversation =
    Boolean(conversationId) && isLoadingHistory && messages.length === 0;

  const bannerError = handoffError ?? error ?? conversationsError;

  async function handleContinue() {
    if (!conversationId || !handoffWorkspaceId) {
      return;
    }
    setHandoffError(null);
    try {
      await continueInAssist(conversationId, {
        userId: session.user.id,
        workspaceId: handoffWorkspaceId,
      });
    } catch {
      setHandoffError("Não foi possível abrir a conversa no Assist.");
    }
  }

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
      {!conversationId ? (
        <ChatHistoryEmpty />
      ) : isLoadingHistoryForConversation ? (
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
            workspaceId={workspaceId}
            readOnly
            footer={
              <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
                <p className="font-technical text-xs text-muted-foreground">
                  Só leitura. Para continuar, use o Assist.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canContinue}
                  onClick={() => void handleContinue()}
                >
                  Continuar no Assist
                </Button>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

function ChatHistoryEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="grid size-10 place-items-center rounded-lg bg-popover text-text-tertiary">
          <MessageSquareText className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Histórico
          </h2>
          <p className="text-sm text-muted-foreground">
            Suas conversas ficam aqui. Para perguntar, abra o Assist com{" "}
            <kbd className="font-technical text-xs">Ctrl+Shift+L</kbd>.
          </p>
        </div>
      </div>
    </div>
  );
}
