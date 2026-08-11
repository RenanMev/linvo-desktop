import { useCallback, useEffect, useRef, useState } from "react";
import type { DeskState, ForceTool, Procedure, ToolRequest } from "@linvo/shared";

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
  createLocalImageAttachment,
  createReplyRef,
  createUserMessage,
  finalizeMessage,
  mergeAttachmentPreviewUrls,
  setMessageModel,
  appendArtifact,
  upsertActivity,
} from "@/lib/chat/chat-state";
import { uploadChatAttachment } from "@/lib/chat/chat-attachments-api";
import {
  decideProcedureOpenRequest,
  isCreateProcedureToolRequest,
  isOpenProcedureToolRequest,
  parseCreateProcedureArgs,
} from "@/lib/chat/procedure-tool-request";
import { readClipboardText } from "@/lib/clipboard";
import { mapApiMessageToChat, mapApiMessagesToChat } from "@/lib/chat/map-message";
import type {
  ChatMessage,
  ChatReplyRef,
  ChatSendAttachment,
} from "@/lib/chat/types";
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
  const streamConversationIdRef = useRef<string | null>(null);
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

  const beginRun = useCallback((targetConversationId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    streamConversationIdRef.current = targetConversationId;
    return controller;
  }, []);

  const isCurrentRun = useCallback(
    (targetConversationId: string, controller: AbortController) =>
      activeConversationRef.current === targetConversationId &&
      streamConversationIdRef.current === targetConversationId &&
      abortRef.current === controller &&
      !controller.signal.aborted,
    [],
  );

  const updateMessagesForRun = useCallback(
    (
      targetConversationId: string,
      controller: AbortController,
      update: (current: ChatMessage[]) => ChatMessage[],
    ) => {
      if (!isCurrentRun(targetConversationId, controller)) {
        return;
      }
      setMessages((current) => {
        const next = update(current);
        persistMessages(targetConversationId, next);
        return next;
      });
    },
    [isCurrentRun, persistMessages],
  );

  const finishRun = useCallback(
    (targetConversationId: string, controller: AbortController) => {
      if (abortRef.current !== controller) {
        return;
      }
      abortRef.current = null;
      streamConversationIdRef.current = null;
      if (activeConversationRef.current === targetConversationId) {
        setIsResponding(false);
      }
    },
    [],
  );

  useEffect(() => {
    const runningController = abortRef.current;
    if (
      conversationId &&
      runningController &&
      !runningController.signal.aborted &&
      streamConversationIdRef.current === conversationId
    ) {
      setIsLoadingHistory(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    streamConversationIdRef.current = null;
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
      if (chainOpenedSlugsRef.current.size > 0) {
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result:
            "Já houve tentativa de abrir procedimento nesta resposta. Não chame open_procedure de novo; responda ao usuário com o conhecimento disponível (ou diga que não há procedimento publicado).",
          assistantId,
        });
        return;
      }

      const decision = decideProcedureOpenRequest(
        request,
        chainOpenedSlugsRef.current,
      );

      if (decision.kind === "already_open") {
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result: `Checklist já aberto: ${decision.slug}. Não tente abrir novamente; responda ao usuário.`,
          assistantId,
        });
        return;
      }

      if (decision.kind !== "open") {
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result:
            "Não foi possível abrir o procedimento solicitado (pedido inválido). Responda ao usuário sem tentar abrir de novo.",
          assistantId,
        });
        return;
      }

      const wsId = workspaceIdRef.current;
      const slug = decision.slug;
      chainOpenedSlugsRef.current.add(slug);

      if (!wsId) {
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result: `Falha ao abrir o checklist "${slug}": workspace indisponível. Não tente abrir novamente; responda ao usuário explicando a falha.`,
          assistantId,
        });
        return;
      }

      try {
        const procedure = await procedureApi.getProcedureBySlug(wsId, slug);
        onOpenProcedureChecklistRef.current?.(procedure);
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result: `Checklist aberto: ${procedure.title ?? slug}`,
          assistantId,
        });
      } catch (caught) {
        const detail = formatChatError(
          caught,
          "Não foi possível abrir o procedimento",
        );
        setError(detail);
        await continueToolResultRef.current?.({
          conversationId: activeConversationId,
          request,
          approved: true,
          result: `Falha ao abrir o checklist "${slug}": ${detail}. Não tente abrir novamente; use search_knowledge ou responda ao usuário explicando a falha.`,
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

      const controller = beginRun(activeConversationId);

      setIsResponding(true);
      setError(null);
      setPendingToolRequest(null);

      let pausedForTool = false;
      let autoOpenRequest: ToolRequest | null = null;
      let currentAssistantId = assistantId;

      try {
        updateMessagesForRun(activeConversationId, controller, (current) =>
          finalizeMessage(current, currentAssistantId, "streaming"),
        );

        for await (const chunk of chatApi.submitToolResult({
          conversationId: activeConversationId,
          requestId: request.requestId,
          approved,
          result,
          deskState: deskStateRef.current,
          model: modelRef.current ?? undefined,
          signal: controller.signal,
          onAssistantDone: (message) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            currentAssistantId = message.id;
            assistantIdRef.current = currentAssistantId;
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === assistantId || item.id === currentAssistantId
                  ? mapped
                  : item,
              );
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolUsed: (tool) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendToolUse(prev, currentAssistantId, tool);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onActivity: (activity) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = upsertActivity(prev, currentAssistantId, activity);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onArtifact: (artifact) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendArtifact(prev, currentAssistantId, artifact);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onReasoningChunk: (text) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendReasoning(prev, currentAssistantId, text);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onModel: (model) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = setMessageModel(prev, currentAssistantId, model);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolRequest: (nextRequest) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            pausedForTool = true;
            if (isOpenProcedureToolRequest(nextRequest)) {
              autoOpenRequest = nextRequest;
            } else {
              setPendingToolRequest(nextRequest);
            }
          },
        })) {
          if (!isCurrentRun(activeConversationId, controller)) {
            break;
          }
          updateMessagesForRun(
            activeConversationId,
            controller,
            (current) => appendToMessage(current, currentAssistantId, chunk),
          );
        }

        if (!isCurrentRun(activeConversationId, controller)) {
          return;
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
          updateMessagesForRun(activeConversationId, controller, (current) =>
            finalizeMessage(current, currentAssistantId, "done"),
          );
        }
      } catch (caught) {
        if (!isCurrentRun(activeConversationId, controller)) {
          return;
        }
        updateMessagesForRun(activeConversationId, controller, (current) =>
          finalizeMessage(current, currentAssistantId, "error"),
        );
          setError(
            formatChatError(caught, "Não foi possível concluir a ferramenta"),
          );
      } finally {
        finishRun(activeConversationId, controller);
      }
    },
    [
      beginRun,
      finishRun,
      isCurrentRun,
      openProcedureAndContinue,
      persistMessages,
      updateMessagesForRun,
    ],
  );

  continueToolResultRef.current = continueToolResult;

  const sendMessage = useCallback(
    async (
      rawContent: string,
      options?: {
        forceTool?: ForceTool;
        attachment?: ChatSendAttachment;
        onAccepted?: () => void;
      },
    ) => {
      if (pendingToolRequest) return;
      const hasAttachment = Boolean(options?.attachment);
      if (!canSendMessage(rawContent, isResponding, { hasAttachment })) return;

      let activeConversationId = conversationId;

      if (!activeConversationId) {
        try {
          const conversation = await chatApi.createConversation();
          if (activeConversationRef.current !== conversationId) {
            return;
          }
          activeConversationId = conversation.id;
          activeConversationRef.current = conversation.id;
          onConversationCreated?.(conversation.id);
        } catch (caught) {
          setError(formatChatError(caught, "Não foi possível criar a conversa"));
          return;
        }
      }

      const activeReply = replyTarget ?? undefined;
      const forceTool = options?.forceTool;
      const sendAttachment = options?.attachment;
      const optimisticUserId = crypto.randomUUID();
      const optimisticAssistantId = crypto.randomUUID();
      const now = Date.now();
      const controller = beginRun(activeConversationId);
      setIsResponding(true);
      setError(null);
      setPendingToolRequest(null);
      chainOpenedSlugsRef.current = new Set();

      let assistantId: string = optimisticAssistantId;
      assistantIdRef.current = assistantId;
      let pausedForTool = false;
      let autoOpenRequest: ToolRequest | null = null;
      let attachmentIds: string[] | undefined;
      let localAttachments: ChatMessage["attachments"];
      let optimisticMessagesAdded = false;

      try {
        if (sendAttachment) {
          const uploaded = await uploadChatAttachment(
            activeConversationId,
            sendAttachment.file,
            {
              filename: sendAttachment.file.name,
              source: "display_capture",
            },
          );
          if (!isCurrentRun(activeConversationId, controller)) {
            return;
          }
          attachmentIds = [uploaded.id];
          localAttachments = [
            createLocalImageAttachment({
              id: uploaded.id,
              file: sendAttachment.file,
              width: uploaded.width ?? sendAttachment.width,
              height: uploaded.height ?? sendAttachment.height,
              previewUrl: URL.createObjectURL(sendAttachment.file),
            }),
          ];
        }

        updateMessagesForRun(
          activeConversationId,
          controller,
          (current) => [
            ...current,
            createUserMessage(
              optimisticUserId,
              rawContent,
              now,
              activeReply,
              localAttachments,
            ),
            createAssistantPlaceholder(optimisticAssistantId, now + 1),
          ],
        );
        optimisticMessagesAdded = true;
        setReplyTarget(null);
        options?.onAccepted?.();

        for await (const chunk of chatApi.streamChatResponse({
          conversationId: activeConversationId,
          content: rawContent,
          replyToMessageId: activeReply?.id,
          deskState: deskStateRef.current,
          model: modelRef.current ?? undefined,
          forceTool,
          attachmentIds,
          signal: controller.signal,
          onUserMessage: (message) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === optimisticUserId
                  ? {
                      ...mapped,
                      replyTo: activeReply,
                      attachments: mergeAttachmentPreviewUrls(
                        mapped.attachments,
                        localAttachments,
                      ),
                    }
                  : item,
              );
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });

            if (onConversationTitleChange && message.content.trim()) {
              onConversationTitleChange(
                activeConversationId,
                message.content.trim().slice(0, 50),
              );
            } else if (
              onConversationTitleChange &&
              !message.content.trim() &&
              (message.attachments?.length ?? 0) > 0
            ) {
              onConversationTitleChange(
                activeConversationId,
                "Contexto visual",
              );
            }
          },
          onAssistantDone: (message) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            assistantId = message.id;
            assistantIdRef.current = assistantId;
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === optimisticAssistantId || item.id === assistantId
                  ? mapped
                  : item,
              );
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolUsed: (tool) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendToolUse(prev, assistantId, tool);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onActivity: (activity) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = upsertActivity(prev, assistantId, activity);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onArtifact: (artifact) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendArtifact(prev, assistantId, artifact);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onReasoningChunk: (text) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendReasoning(prev, assistantId, text);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onModel: (model) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = setMessageModel(prev, assistantId, model);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolRequest: (request) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            pausedForTool = true;
            if (isOpenProcedureToolRequest(request)) {
              autoOpenRequest = request;
            } else {
              setPendingToolRequest(request);
            }
          },
        })) {
          if (!isCurrentRun(activeConversationId, controller)) {
            break;
          }
          updateMessagesForRun(
            activeConversationId,
            controller,
            (current) => appendToMessage(current, assistantId, chunk),
          );
        }

        if (!isCurrentRun(activeConversationId, controller)) {
          return;
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
          updateMessagesForRun(activeConversationId, controller, (current) =>
            finalizeMessage(current, assistantId, "done"),
          );
        }
      } catch (caught) {
        if (!isCurrentRun(activeConversationId, controller)) {
          return;
        }
        if (optimisticMessagesAdded) {
          updateMessagesForRun(activeConversationId, controller, (current) =>
            finalizeMessage(current, assistantId, "error"),
          );
        }
        setError(
          formatChatError(caught, "Não foi possível obter resposta do assistente"),
        );
      } finally {
        finishRun(activeConversationId, controller);
      }
    },
    [
      conversationId,
      beginRun,
      finishRun,
      isCurrentRun,
      isResponding,
      pendingToolRequest,
      replyTarget,
      onConversationCreated,
      onConversationTitleChange,
      persistMessages,
      openProcedureAndContinue,
      updateMessagesForRun,
    ],
  );

  const regenerateMessage = useCallback(
    async (assistantMessageId: string) => {
      if (!conversationId || pendingToolRequest || isResponding) {
        return;
      }

      const target = messages.find((message) => message.id === assistantMessageId);
      if (
        !target ||
        target.role !== "assistant" ||
        (target.status !== "done" && target.status !== "error")
      ) {
        return;
      }

      const lastRegenerable = [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" &&
            (message.status === "done" || message.status === "error"),
        );
      if (!lastRegenerable || lastRegenerable.id !== assistantMessageId) {
        return;
      }

      const activeConversationId = conversationId;

      const controller = beginRun(activeConversationId);

      let assistantId = assistantMessageId;
      assistantIdRef.current = assistantId;
      setIsResponding(true);
      setError(null);
      setPendingToolRequest(null);
      chainOpenedSlugsRef.current = new Set();

      setMessages((prev) => {
        const next = prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: "",
                status: "streaming" as const,
                toolUses: undefined,
                activities: undefined,
                reasoning: undefined,
                model: undefined,
              }
            : message,
        );
        persistMessages(activeConversationId, next);
        return next;
      });

      let pausedForTool = false;
      let autoOpenRequest: ToolRequest | null = null;

      try {
        for await (const chunk of chatApi.regenerateMessage({
          conversationId: activeConversationId,
          messageId: assistantId,
          deskState: deskStateRef.current,
          model: modelRef.current ?? undefined,
          signal: controller.signal,
          onAssistantDone: (message) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            assistantId = message.id;
            assistantIdRef.current = assistantId;
            const mapped = mapApiMessageToChat(message);
            setMessages((prev) => {
              const next = prev.map((item) =>
                item.id === assistantMessageId || item.id === assistantId
                  ? mapped
                  : item,
              );
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolUsed: (tool) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendToolUse(prev, assistantId, tool);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onActivity: (activity) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = upsertActivity(prev, assistantId, activity);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onArtifact: (artifact) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendArtifact(prev, assistantId, artifact);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onReasoningChunk: (text) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = appendReasoning(prev, assistantId, text);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onModel: (model) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            setMessages((prev) => {
              const next = setMessageModel(prev, assistantId, model);
              if (isCurrentRun(activeConversationId, controller)) {
                persistMessages(activeConversationId, next);
              }
              return next;
            });
          },
          onToolRequest: (request) => {
            if (!isCurrentRun(activeConversationId, controller)) {
              return;
            }
            pausedForTool = true;
            if (isOpenProcedureToolRequest(request)) {
              autoOpenRequest = request;
            } else {
              setPendingToolRequest(request);
            }
          },
        })) {
          if (!isCurrentRun(activeConversationId, controller)) {
            break;
          }
          updateMessagesForRun(
            activeConversationId,
            controller,
            (current) => appendToMessage(current, assistantId, chunk),
          );
        }

        if (!isCurrentRun(activeConversationId, controller)) {
          return;
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
          updateMessagesForRun(activeConversationId, controller, (current) =>
            finalizeMessage(current, assistantId, "done"),
          );
        }
      } catch (caught) {
        if (!isCurrentRun(activeConversationId, controller)) {
          return;
        }
        updateMessagesForRun(activeConversationId, controller, (current) =>
          finalizeMessage(current, assistantId, "error"),
        );
          setError(
            formatChatError(caught, "Não foi possível regenerar a resposta"),
          );
      } finally {
        finishRun(activeConversationId, controller);
      }
    },
    [
      conversationId,
      beginRun,
      finishRun,
      isCurrentRun,
      messages,
      pendingToolRequest,
      isResponding,
      persistMessages,
      openProcedureAndContinue,
      updateMessagesForRun,
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
    regenerateMessage,
    startReply,
    cancelReply,
    resolveToolRequest,
  };
}
