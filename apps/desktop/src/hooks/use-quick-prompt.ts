import { useCallback, useRef, useState } from "react";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import * as chatApi from "@/lib/chat/chat-api";
import { ChatApiError } from "@/lib/chat/chat-api";

export type QuickPromptStatus = "idle" | "streaming" | "done" | "error";

export type QuickPromptController = {
  status: QuickPromptStatus;
  responseText: string;
  errorMessage: string | null;
  conversationId: string | null;
  isThinking: boolean;
  send: (text: string) => Promise<boolean>;
  stop: () => void;
  reset: () => void;
};

function formatError(error: unknown): string {
  if (error instanceof AuthApiError && error.status === 401) {
    return "Sessão expirada. Abra o painel para entrar novamente.";
  }
  if (error instanceof AuthNetworkError) {
    return "Sem conexão com o servidor";
  }
  if (error instanceof ChatApiError) {
    return error.message;
  }
  return "Erro inesperado";
}

export function useQuickPrompt(): QuickPromptController {
  const [status, setStatus] = useState<QuickPromptStatus>("idle");
  const [responseText, setResponseText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsThinking(false);
    setStatus((current) => (current === "streaming" ? "done" : current));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    conversationIdRef.current = null;
    setStatus("idle");
    setResponseText("");
    setErrorMessage(null);
    setConversationId(null);
    setIsThinking(false);
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || abortRef.current) {
      return false;
    }

    setErrorMessage(null);
    setResponseText("");
    setStatus("streaming");
    setIsThinking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let activeConversationId = conversationIdRef.current;
      if (!activeConversationId) {
        const conversation = await chatApi.createConversation();
        if (
          controller.signal.aborted ||
          abortRef.current !== controller
        ) {
          return false;
        }
        activeConversationId = conversation.id;
        conversationIdRef.current = conversation.id;
        setConversationId(conversation.id);
      }

      const stream = chatApi.streamChatResponse({
        conversationId: activeConversationId,
        content,
        signal: controller.signal,
        onActivity: () => {
          if (
            abortRef.current === controller &&
            !controller.signal.aborted
          ) {
            setIsThinking(true);
          }
        },
      });

      for await (const chunk of stream) {
        if (abortRef.current !== controller) {
          return false;
        }
        if (controller.signal.aborted) {
          return true;
        }
        setIsThinking(false);
        setResponseText((current) => current + chunk);
      }

      setStatus("done");
      return true;
    } catch (error) {
      if (controller.signal.aborted) {
        if (abortRef.current === controller) {
          setStatus("done");
          return true;
        }
      } else {
        setStatus("error");
        setErrorMessage(formatError(error));
      }
      return false;
    } finally {
      if (abortRef.current === controller) {
        setIsThinking(false);
        abortRef.current = null;
      }
    }
  }, []);

  return {
    status,
    responseText,
    errorMessage,
    conversationId,
    isThinking,
    send,
    stop,
    reset,
  };
}
