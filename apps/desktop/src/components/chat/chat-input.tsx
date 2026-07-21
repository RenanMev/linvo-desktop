import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { LlmModelOption, Procedure } from "@linvo/shared";
import { ArrowUp } from "lucide-react";

import { ChatModelPicker } from "@/components/chat/chat-model-picker";
import { ChatReplyPreview } from "@/components/chat/chat-reply-preview";
import { Button } from "@/components/ui/button";
import { canSendMessage } from "@/lib/chat/chat-state";
import {
  fetchLlmModels,
  loadSelectedModel,
  saveSelectedModel,
} from "@/lib/chat/llm-models";
import type { ChatReplyRef } from "@/lib/chat/types";
import * as procedureApi from "@/lib/procedure/procedure-api";
import {
  extractSlashSlug,
  filterPublishedSlugs,
  parseSlashQuery,
} from "@/lib/procedure/slash-procedure";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSend: (content: string) => void;
  isResponding: boolean;
  replyTarget: ChatReplyRef | null;
  onCancelReply: () => void;
  disabled?: boolean;
  workspaceId?: string | null;
  selectedModel?: string | null;
  onModelChange?: (modelId: string) => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
};

export function ChatInput({
  onSend,
  isResponding,
  replyTarget,
  onCancelReply,
  disabled = false,
  workspaceId = null,
  selectedModel = null,
  onModelChange,
  onOpenProcedureChecklist,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [publishedSlugs, setPublishedSlugs] = useState<string[]>([]);
  const [slashError, setSlashError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [models, setModels] = useState<LlmModelOption[]>([]);
  const [modelId, setModelId] = useState(selectedModel ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = canSendMessage(value, isResponding) && !disabled;
  const slashQuery = parseSlashQuery(value);
  const slashOpen =
    slashQuery !== null &&
    Boolean(workspaceId) &&
    Boolean(onOpenProcedureChecklist) &&
    !disabled &&
    !isResponding;
  const filteredSlugs = slashOpen
    ? filterPublishedSlugs(publishedSlugs, slashQuery ?? "")
    : [];

  const onModelChangeRef = useRef(onModelChange);
  onModelChangeRef.current = onModelChange;

  useEffect(() => {
    let cancelled = false;
    void fetchLlmModels()
      .then((catalog) => {
        if (cancelled) {
          return;
        }
        setModels(catalog.models);
        const preferred = loadSelectedModel(catalog.defaultModel);
        const allowed = catalog.models.some((model) => model.id === preferred)
          ? preferred
          : catalog.defaultModel;
        setModelId(allowed);
        onModelChangeRef.current?.(allowed);
        saveSelectedModel(allowed);
      })
      .catch(() => {
        if (!cancelled) {
          setModels([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedModel && selectedModel !== modelId) {
      setModelId(selectedModel);
    }
  }, [modelId, selectedModel]);

  const handleModelChange = useCallback(
    (nextModelId: string) => {
      setModelId(nextModelId);
      saveSelectedModel(nextModelId);
      onModelChange?.(nextModelId);
    },
    [onModelChange],
  );

  useEffect(() => {
    if (!slashOpen || !workspaceId) {
      return;
    }

    let cancelled = false;

    void procedureApi
      .listProcedures(workspaceId, ["PUBLISHED"])
      .then((procedures) => {
        if (cancelled) {
          return;
        }
        setPublishedSlugs(
          procedures
            .map((procedure) => procedure.slug)
            .filter((slug): slug is string => Boolean(slug)),
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setPublishedSlugs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [slashOpen, workspaceId]);

  useEffect(() => {
    setActiveIndex(0);
  }, [slashQuery, filteredSlugs.length]);

  async function openProcedureBySlug(slug: string) {
    if (!workspaceId || !onOpenProcedureChecklist || resolving) {
      return;
    }

    setResolving(true);
    setSlashError(null);
    try {
      const procedure = await procedureApi.getProcedureBySlug(
        workspaceId,
        slug,
      );
      onOpenProcedureChecklist(procedure);
      setValue("");
      setSlashError(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      setSlashError("Procedure não foi encontrado");
    } finally {
      setResolving(false);
    }
  }

  function handleSend() {
    if (!canSend) return;
    onSend(value);
    setValue("");
    setSlashError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen && filteredSlugs.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % filteredSlugs.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + filteredSlugs.length) % filteredSlugs.length,
        );
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const selected = filteredSlugs[activeIndex];
        if (selected) {
          void openProcedureBySlug(selected);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setValue("");
        setSlashError(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const slug = extractSlashSlug(value);
      if (slug && workspaceId && onOpenProcedureChecklist) {
        void openProcedureBySlug(slug);
        return;
      }
      handleSend();
    }
  }

  function handleInput(event: ChangeEvent<HTMLTextAreaElement>) {
    setValue(event.target.value);
    setSlashError(null);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    textareaRef.current?.focus();
  }, [replyTarget]);

  return (
    <div className="border-t bg-background px-4 py-4">
      {replyTarget && (
        <ChatReplyPreview replyTarget={replyTarget} onCancel={onCancelReply} />
      )}

      <div className="relative">
        {slashOpen && filteredSlugs.length > 0 ? (
          <ul
            role="listbox"
            aria-label="Procedures publicados"
            className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-48 overflow-y-auto rounded-xl border bg-popover p-1 shadow-md"
          >
            {filteredSlugs.map((slug, index) => (
              <li key={slug} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full rounded-lg px-3 py-2 text-left text-sm",
                    index === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void openProcedureBySlug(slug)}
                >
                  /{slug}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-1 rounded-2xl border bg-muted/40 p-2",
            disabled && "opacity-60",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              replyTarget ? "Escreva sua resposta..." : "Pergunte qualquer coisa..."
            }
            rows={1}
            disabled={disabled || isResponding || resolving}
            className="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <ChatModelPicker
              models={models}
              value={modelId}
              onChange={handleModelChange}
              disabled={disabled || isResponding || resolving}
            />
            <Button
              size="icon-sm"
              onClick={handleSend}
              disabled={!canSend || resolving}
              title="Enviar"
              className="shrink-0 rounded-xl"
            >
              <ArrowUp />
            </Button>
          </div>
        </div>
      </div>

      {slashError ? (
        <p className="mt-2 text-center text-xs text-destructive" role="alert">
          {slashError}
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      )}
    </div>
  );
}
