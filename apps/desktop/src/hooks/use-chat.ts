import { useCallback, useEffect, useRef, useState } from "react";
import type { DeskState, Procedure, ToolRequest } from "@linvo/shared";

import { AuthApiError } from "@/lib/auth/auth-api";
import { PANEL_SESSION_UNAVAILABLE_MESSAGE } from "@/hooks/use-panel-session";
import * as chatApi from "@/lib/chat/chat-api";
import {
  hydrateChatLocalStore,
  loadCachedConversationMessagesFromStore,
  saveCachedConversationMessages,
} from "@/lib/chat/chat-local-store";
import {
  appendReasoning,
  appendToMessage,
  appendToolUse,
  canSendMessage,
  createAssistantPlaceholder,
  createReplyRef,
  createUserMessage,
  finalizeMessage,
  setMessageModel,
  upsertActivity,
} from "@/lib/chat/chat-state";
import {
  decideProcedureOpenRequest,
  isCreateProcedureToolRequest,
  isOpenProcedureToolRequest,
  parseCreateProcedureArgs,
} from "@/lib/chat/procedure-tool-request";
import { readClipboardText } from "@/lib/clipboard";
import { mapApiMessageToChat, mapApiMessagesToChat } from "@/lib/chat/map-message";
import type { ChatMessage, ChatReplyRef } from "@/lib/chat/types";
import * as procedureApi from "@/lib/procedure/procedure-api";

type UseChatOptions = {
  conversationId: string | null;
  workspaceId?: string | null;
  deskState?: DeskState;
  model?: string | null;
  onConversationTitleChange?: (conversationId: string, title: string) => void;
  onConversationCreated?: (id: string) => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
};

function formatChatError(error: unknown, fallback: string): string {
  if (error instanceof AuthApiError && error.status === 401) {
    return PANEL_SESSION_UNAVAILABLE_MESSAGE;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function useChat({
  conversationId,
  workspaceId = null,
  deskState,
  model = null,
  onConversationTitleChange,
  onConversationCreated,
  onOpenProcedureChecklist,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatReplyRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingToolRequest, setPendingToolRequest] = useState<ToolRequest | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const activeConversationRef = useRef<string | null>(conversationId);
  const assistantIdRef = useRef<string | null>(null);
  const workspaceIdRef = useRef<string | null>(workspaceId);
  const onOpenProcedureChecklistRef = useRef(onOpenProcedureChecklist);
  const deskStateRef = useRef(deskState);
  const modelRef = useRef(model);
  const chainOpenedSlugsRef = useRef<Set<string>>(new Set());

  activeConversationRef.current = conversationId;
  workspaceIdRef.current = workspaceId;
  onOpenProcedureChecklistRef.current = onOpenProcedureChecklist;
  deskStateRef.current = deskState;
  modelRef.current = model;

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
    setPendingToolRequest(null);
    assistantIdRef.current = null;
    chainOpenedSlugsRef.current = new Set();

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

  const continueToolResultRef = useRef<
    | ((options: {
        conversationId: string;
        request: ToolRequest;
        approved: boolean;
        result?: string;
        assistantId: string;
      }) => Promise<void>)
    | null
  >(null);

  const openProcedureAndContinue = useCallback(
    async (
      activeConversationId: string,
      request: ToolRequest,
      assistantId: string,
    ) => {
      const decision = decideProcedureOpenRequest(
        request,
        chainOpenedSlugsRef.current,
      );

      if (decision.kind === "already_open") {
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result: `Checklist já aberto: ${decision.slug}`,
          assistantId,
        });
        return;
      }

      if (decision.kind !== "open") {
        setPendingToolRequest(request);
        setIsResponding(false);
        setError("Não foi possível abrir o procedimento solicitado.");
        return;
      }

      const wsId = workspaceIdRef.current;
      const slug = decision.slug;
      if (!wsId) {
        setPendingToolRequest(request);
        setIsResponding(false);
        setError("Não foi possível abrir o procedimento solicitado.");
        return;
      }

      try {
        const procedure = await procedureApi.getProcedureBySlug(wsId, slug);
        chainOpenedSlugsRef.current.add(slug);
        onOpenProcedureChecklistRef.current?.(procedure);
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result: `Checklist aberto: ${procedure.title ?? slug}`,
          assistantId,
        });
      } catch (caught) {
        setPendingToolRequest(null);
        setIsResponding(false);
        setError(
          formatChatError(caught, "Não foi possível abrir o procedimento"),
        );
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: false,
          assistantId,
        });
      }
    },
    [],
  );

  const continueToolResult = useCallback(
    async (options: {
      conversationId: string;
      request: ToolRequest;
      approved: boolean;
      result?: string;
      assistantId: string;
    }) => {
      const {
        conversationId: activeConversationId,
        request,
        approved,
        result,
        assistantId,
      } = options;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsResponding(true);
      setError(null);
      setPendingToolRequest(null);

      let pausedForTool = false;
      let autoOpenRequest: ToolRequest | null = null;
      let currentAssistantId = assistantId;

      try {
        setMessages((prev) => {
          const next = finalizeMessage(prev, currentAssistantId, "streaming");
          persistMessages(activeConversationId, next);
          return next;
        });

        for await (const chunk of chatApi.submitToolResult({
          conversationId: activeConversationId,
          requestId: request.requestId,
          approved,
          result,
          deskState: deskStateRef.current,
          model: modelRef.current ?? undefined,
          signal: controller.signal,
          onAssistantDone: (message) => {
            currentAssistantId = message.id;
            assistantIdRef.current = currentAssistantId;
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === assistantId || item.id === currentAssistantId
                  ? mapped
                  : item,
              );
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolUsed: (tool) => {
            setMessages((prev) => {
              const next = appendToolUse(prev, currentAssistantId, tool);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onActivity: (activity) => {
            setMessages((prev) => {
              const next = upsertActivity(prev, currentAssistantId, activity);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onReasoningChunk: (text) => {
            setMessages((prev) => {
              const next = appendReasoning(prev, currentAssistantId, text);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onModel: (model) => {
            setMessages((prev) => {
              const next = setMessageModel(prev, currentAssistantId, model);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolRequest: (nextRequest) => {
            pausedForTool = true;
            if (isOpenProcedureToolRequest(nextRequest)) {
              autoOpenRequest = nextRequest;
            } else {
              setPendingToolRequest(nextRequest);
            }
          },
        })) {
          if (activeConversationRef.current !== activeConversationId) {
            break;
          }
          setMessages((prev) => appendToMessage(prev, currentAssistantId, chunk));
        }

        if (autoOpenRequest) {
          await openProcedureAndContinue(
            activeConversationId,
            autoOpenRequest,
            currentAssistantId,
          );
          return;
        }

        if (!pausedForTool) {
          setMessages((prev) => {
            const next = finalizeMessage(prev, currentAssistantId, "done");
            persistMessages(activeConversationId, next);
            return next;
          });
        }
      } catch (caught) {
        setMessages((prev) => {
          const next = finalizeMessage(prev, currentAssistantId, "error");
          persistMessages(activeConversationId, next);
          return next;
        });
        if (activeConversationRef.current === activeConversationId) {
          setError(
            formatChatError(caught, "Não foi possível concluir a ferramenta"),
          );
        }
      } finally {
        if (activeConversationRef.current === activeConversationId) {
          setIsResponding(false);
        }
      }
    },
    [persistMessages, openProcedureAndContinue],
  );

  continueToolResultRef.current = continueToolResult;

  const sendMessage = useCallback(
    async (rawContent: string) => {
      if (pendingToolRequest) return;
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
      setPendingToolRequest(null);
      chainOpenedSlugsRef.current = new Set();

      let assistantId: string = optimisticAssistantId;
      assistantIdRef.current = assistantId;
      let pausedForTool = false;
      let autoOpenRequest: ToolRequest | null = null;

      try {
        for await (const chunk of chatApi.streamChatResponse({
          conversationId: activeConversationId,
          content: rawContent,
          replyToMessageId: activeReply?.id,
          deskState: deskStateRef.current,
          model: modelRef.current ?? undefined,
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
            assistantIdRef.current = assistantId;
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === optimisticAssistantId || item.id === assistantId
                  ? mapped
                  : item,
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
          onActivity: (activity) => {
            setMessages((prev) => {
              const next = upsertActivity(prev, assistantId, activity);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onReasoningChunk: (text) => {
            setMessages((prev) => {
              const next = appendReasoning(prev, assistantId, text);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onModel: (model) => {
            setMessages((prev) => {
              const next = setMessageModel(prev, assistantId, model);
              if (activeConversationRef.current === activeConversationId) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolRequest: (request) => {
            pausedForTool = true;
            if (isOpenProcedureToolRequest(request)) {
              autoOpenRequest = request;
            } else {
              setPendingToolRequest(request);
            }
          },
        })) {
          if (activeConversationRef.current !== activeConversationId) {
            break;
          }
          setMessages((prev) => appendToMessage(prev, assistantId, chunk));
        }

        if (autoOpenRequest) {
          await openProcedureAndContinue(
            activeConversationId,
            autoOpenRequest,
            assistantId,
          );
          return;
        }

        if (!pausedForTool) {
          setMessages((prev) => {
            const next = finalizeMessage(prev, assistantId, "done");
            persistMessages(activeConversationId, next);
            return next;
          });
        }
      } catch (caught) {
        setMessages((prev) => {
          const next = finalizeMessage(prev, assistantId, "error");
          persistMessages(activeConversationId, next);
          return next;
        });
        if (activeConversationRef.current === activeConversationId) {
          setError(
            formatChatError(caught, "Não foi possível obter resposta do assistente"),
          );
        }
      } finally {
        if (
          activeConversationRef.current === activeConversationId &&
          !autoOpenRequest
        ) {
          setIsResponding(false);
        }
      }
    },
    [
      conversationId,
      isResponding,
      pendingToolRequest,
      replyTarget,
      onConversationCreated,
      onConversationTitleChange,
      persistMessages,
      openProcedureAndContinue,
    ],
  );

  const resolveToolRequest = useCallback(
    async (approved: boolean) => {
      if (!conversationId || !pendingToolRequest || isResponding) return;

      const activeConversationId = conversationId;
      const request = pendingToolRequest;
      const assistantId = assistantIdRef.current;
      if (!assistantId) return;

      if (approved && isOpenProcedureToolRequest(request)) {
        setPendingToolRequest(null);
        await openProcedureAndContinue(
          activeConversationId,
          request,
          assistantId,
        );
        return;
      }

      let result: string | undefined;

      if (approved) {
        if (isCreateProcedureToolRequest(request)) {
          const wsId = workspaceIdRef.current;
          const args = parseCreateProcedureArgs(request.args);
          if (!wsId || !args) {
            setError("Dados inválidos para criar o procedimento.");
            return;
          }
          try {
            const procedure = await procedureApi.createProcedureFromText(
              wsId,
              args,
            );
            result = `Procedimento publicado: /${procedure.slug} (${procedure.title})`;
          } catch (caught) {
            setError(
              formatChatError(caught, "Não foi possível criar o procedimento"),
            );
            return;
          }
        } else {
          result = await readClipboardText();
        }
      }

      await continueToolResult({
        conversationId: activeConversationId,
        request,
        approved,
        result,
        assistantId,
      });
    },
    [
      conversationId,
      pendingToolRequest,
      isResponding,
      continueToolResult,
      openProcedureAndContinue,
    ],
  );

  return {
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
  };
}
