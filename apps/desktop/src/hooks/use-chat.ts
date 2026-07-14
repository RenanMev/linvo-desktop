import { useCallback, useEffect, useRef, useState } from "react";

import { AuthApiError } from "@/lib/auth/auth-api";
import { PANEL_SESSION_UNAVAILABLE_MESSAGE } from "@/hooks/use-panel-session";
import * as chatApi from "@/lib/chat/chat-api";
import {
  hydrateChatLocalStore,
  loadCachedConversationMessagesFromStore,
  saveCachedConversationMessages,
} from "@/lib/chat/chat-local-store";
import {
  appendToMessage,
  appendToolUse,
  canSendMessage,
  createAssistantPlaceholder,
  createReplyRef,
  createUserMessage,
  finalizeMessage,
} from "@/lib/chat/chat-state";
import { mapApiMessageToChat, mapApiMessagesToChat } from "@/lib/chat/map-message";
import type { ChatMessage, ChatReplyRef } from "@/lib/chat/types";

type UseChatOptions = {
  conversationId: string | null;
  onConversationTitleChange?: (conversationId: string, title: string) => void;
  onConversationCreated?: (id: string) => void;
};

function formatChatError(error: unknown, fallback: string): string {
  if (error instanceof AuthApiError && error.status === 401) {
    return PANEL_SESSION_UNAVAILABLE_MESSAGE;
  }
  return fallback;
}

export function useChat({
  conversationId,
  onConversationTitleChange,
  onConversationCreated,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatReplyRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeConversationRef = useRef<string | null>(conversationId);

  activeConversationRef.current = conversationId;

  const persistMessages = useCallback(
    (targetConversationId: string, nextMessages: ChatMessage[]) => {
      saveCachedConversationMessages(targetConversationId, nextMessages);
    },
    [],
  );

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setReplyTarget(null);
    setIsResponding(false);

    if (!conversationId) {
      setMessages([]);
      setIsLoadingHistory(false);
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      await hydrateChatLocalStore();
      if (cancelled || activeConversationRef.current !== conversationId) {
        return;
      }

      const cached = await loadCachedConversationMessagesFromStore(conversationId);
      if (cancelled || activeConversationRef.current !== conversationId) {
        return;
      }

      setMessages(cached);
      setIsLoadingHistory(cached.length === 0);
      setError(null);

      try {
        const history = await chatApi.listMessages(conversationId);
        if (cancelled || activeConversationRef.current !== conversationId) {
          return;
        }

        const mapped = mapApiMessagesToChat(history);
        setMessages(mapped);
        persistMessages(conversationId, mapped);
        setError(null);
      } catch (caught) {
        if (cancelled || activeConversationRef.current !== conversationId) {
          return;
        }

        if (cached.length > 0) {
          setError(null);
          return;
        }

        setError(formatChatError(caught, "Não foi possível carregar o histórico"));
        setMessages([]);
      } finally {
        if (!cancelled && activeConversationRef.current === conversationId) {
          setIsLoadingHistory(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, persistMessages]);

  const startReply = useCallback((message: ChatMessage) => {
    const ref = createReplyRef(message);
    if (ref) setReplyTarget(ref);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const sendMessage = useCallback(
    async (rawContent: string) => {
      if (!canSendMessage(rawContent, isResponding)) return;

      let activeConversationId = conversationId;

      if (!activeConversationId) {
        try {
          const conversation = await chatApi.createConversation();
          activeConversationId = conversation.id;
          onConversationCreated?.(conversation.id);
        } catch (caught) {
          setError(formatChatError(caught, "Não foi possível criar a conversa"));
          return;
        }
      }

      const activeReply = replyTarget ?? undefined;
      const optimisticUserId = crypto.randomUUID();
      const optimisticAssistantId = crypto.randomUUID();
      const now = Date.now();

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((prev) => [
        ...prev,
        createUserMessage(optimisticUserId, rawContent, now, activeReply),
        createAssistantPlaceholder(optimisticAssistantId, now + 1),
      ]);
      setReplyTarget(null);
      setIsResponding(true);
      setError(null);

      let assistantId: string = optimisticAssistantId;

      try {
        for await (const chunk of chatApi.streamChatResponse({
          conversationId: activeConversationId,
          content: rawContent,
          replyToMessageId: activeReply?.id,
          signal: controller.signal,
          onUserMessage: (message) => {
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === optimisticUserId
                  ? { ...mapped, replyTo: activeReply }
                  : item,
              );
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });

            if (onConversationTitleChange && message.content.trim()) {
              onConversationTitleChange(
                activeConversationId,
                message.content.trim().slice(0, 50),
              );
            }
          },
          onAssistantDone: (message) => {
            assistantId = message.id;
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === optimisticAssistantId ? mapped : item,
              );
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolUsed: (tool) => {
            setMessages((prev) => {
              const next = appendToolUse(prev, assistantId, tool);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
        })) {
          if (activeConversationRef.current !== activeConversationId) {
            break;
          }
          setMessages((prev) => appendToMessage(prev, assistantId, chunk));
        }

        setMessages((prev) => {
          const next = finalizeMessage(prev, assistantId, "done");
          persistMessages(activeConversationId, next);
          return next;
        });
      } catch (caught) {
        setMessages((prev) => {
          const next = finalizeMessage(prev, assistantId, "error");
          persistMessages(activeConversationId, next);
          return next;
        });
        if (activeConversationRef.current === activeConversationId) {
          setError(formatChatError(caught, "Não foi possível obter resposta do assistente"));
        }
      } finally {
        if (activeConversationRef.current === activeConversationId) {
          setIsResponding(false);
        }
      }
    },
    [
      conversationId,
      isResponding,
      replyTarget,
      onConversationCreated,
      onConversationTitleChange,
      persistMessages,
    ],
  );

  return {
    messages,
    isResponding,
    isLoadingHistory,
    replyTarget,
    error,
    sendMessage,
    startReply,
    cancelReply,
  };
}
