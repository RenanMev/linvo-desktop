import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  getToolLabel,
  type ForceTool,
  type LlmModelOption,
  type Procedure,
} from "@linvo/shared";
import {
  AppWindow,
  ArrowUp,
  Monitor,
  Paperclip,
  SquareDashedMousePointer,
  X,
} from "lucide-react";

import { CapturePreviewDialog } from "@/components/chat/capture-preview-dialog";
import { ChatModelPicker } from "@/components/chat/chat-model-picker";
import { ChatReplyPreview } from "@/components/chat/chat-reply-preview";
import { ChatToolsMenu } from "@/components/chat/chat-tools-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDisplaySnapshot } from "@/hooks/use-display-snapshot";
import { canSendMessage } from "@/lib/chat/chat-state";
import {
  fetchLlmModels,
  loadSelectedModel,
  saveSelectedModel,
} from "@/lib/chat/llm-models";
import { fetchUserLlmStatus } from "@/lib/llm/llm-credential-api";
import type { ChatReplyRef, ChatSendAttachment } from "@/lib/chat/types";
import * as procedureApi from "@/lib/procedure/procedure-api";
import {
  extractSlashSlug,
  filterPublishedSlugs,
  parseSlashQuery,
} from "@/lib/procedure/slash-procedure";
import { cn } from "@/lib/utils";

export type { ChatSendAttachment };

export type ChatSendOptions = {
  forceTool?: ForceTool;
  attachment?: ChatSendAttachment;
  onAccepted?: () => void;
};

type ChatInputProps = {
  onSend: (content: string, options?: ChatSendOptions) => void;
  isResponding: boolean;
  replyTarget: ChatReplyRef | null;
  onCancelReply: () => void;
  disabled?: boolean;
  workspaceId?: string | null;
  selectedModel?: string | null;
  onModelChange?: (modelId: string | null) => void;
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
  const [forceTool, setForceTool] = useState<ForceTool | null>(null);
  const [publishedSlugs, setPublishedSlugs] = useState<string[]>([]);
  const [slashError, setSlashError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [models, setModels] = useState<LlmModelOption[]>([]);
  const [modelId, setModelId] = useState(selectedModel ?? "");
  const [modelSelectionEnabled, setModelSelectionEnabled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    pending,
    draft,
    isCapturing,
    isCropping,
    error: captureError,
    capture,
    confirmDraft,
    discardDraft,
    clear: clearPending,
    clearError: clearCaptureError,
  } = useDisplaySnapshot();

  const hasAttachment = pending?.status === "ready";
  const canSend =
    canSendMessage(value, isResponding, { hasAttachment }) && !disabled;
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
    void Promise.all([fetchLlmModels(), fetchUserLlmStatus()])
      .then(([catalog, status]) => {
        if (cancelled) {
          return;
        }
        const selectionEnabled = Boolean(
          status.effective?.modelSelectionEnabled,
        );
        setModelSelectionEnabled(selectionEnabled);
        setModels(catalog.models);
        if (!selectionEnabled) {
          setModelId("");
          onModelChangeRef.current?.(null);
          return;
        }
        const preferred = loadSelectedModel(
          status.effective?.model ?? catalog.defaultModel,
        );
        const allowed = catalog.models.some((model) => model.id === preferred)
          ? preferred
          : (status.effective?.model ?? catalog.defaultModel);
        setModelId(allowed);
        onModelChangeRef.current?.(allowed);
        saveSelectedModel(allowed);
      })
      .catch(() => {
        if (!cancelled) {
          setModels([]);
          setModelSelectionEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
    const submittedValue = value;
    const submittedForceTool = forceTool;
    const submittedPending = pending?.status === "ready" ? pending : null;

    onSend(submittedValue, {
      ...(submittedForceTool ? { forceTool: submittedForceTool } : {}),
      ...(submittedPending
        ? {
            attachment: {
              file: submittedPending.file,
              width: submittedPending.width,
              height: submittedPending.height,
              previewUrl: submittedPending.previewUrl,
              ...(submittedPending.sourceLabel
                ? { sourceLabel: submittedPending.sourceLabel }
                : {}),
            },
          }
        : {}),
      onAccepted: () => {
        setValue((current) => (current === submittedValue ? "" : current));
        setForceTool((current) =>
          current === submittedForceTool ? null : current,
        );
        if (submittedPending) {
          clearPending();
        }
        setSlashError(null);
        clearCaptureError();
        if (
          textareaRef.current &&
          textareaRef.current.value === submittedValue
        ) {
          textareaRef.current.style.height = "auto";
        }
      },
    });
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

  const controlsDisabled =
    disabled || isResponding || resolving || isCapturing || isCropping;

  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 px-6 pb-5 pt-2">
      {draft ? (
        <CapturePreviewDialog
          previewUrl={draft.previewUrl}
          sourceWidth={draft.snapshot.width}
          sourceHeight={draft.snapshot.height}
          {...(draft.snapshot.sourceLabel
            ? { sourceLabel: draft.snapshot.sourceLabel }
            : {})}
          isBusy={isCropping}
          onConfirm={(region) => void confirmDraft(region)}
          onRecapture={() => {
            discardDraft();
            void capture();
          }}
          onCancel={discardDraft}
        />
      ) : null}

      {replyTarget && (
        <ChatReplyPreview replyTarget={replyTarget} onCancel={onCancelReply} />
      )}

      <div className="relative">
        {slashOpen && filteredSlugs.length > 0 ? (
          <ul
            role="listbox"
            aria-label="Procedures publicados"
            className="scrollbar-elegant absolute bottom-full left-0 right-0 z-10 mb-2 max-h-48 overflow-y-auto rounded-premium border border-hairline bg-popover p-1 shadow-xl"
          >
            {filteredSlugs.map((slug, index) => (
              <li key={slug} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full rounded-lg px-3 py-2 text-left font-technical text-sm",
                    index === activeIndex
                      ? "nav-pill-active"
                      : "text-foreground/70 hover:bg-surface-hover hover:text-foreground",
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
            "surface-premium flex flex-col gap-1 rounded-premium p-2 shadow-lg transition-colors focus-within:border-hairline-strong",
            disabled && "opacity-50",
          )}
        >
          {forceTool || pending ? (
            <div className="flex flex-wrap items-center gap-1 px-1 pt-1">
              {forceTool ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-raise-2 px-2 py-0.5 text-xs text-foreground/80">
                  {getToolLabel(forceTool)}
                  <button
                    type="button"
                    className="rounded-md p-0.5 hover:bg-surface-hover"
                    title="Remover ferramenta"
                    disabled={controlsDisabled}
                    onClick={() => setForceTool(null)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : null}
              {pending ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-raise-2 py-1 pr-1.5 pl-1 text-xs text-foreground/80">
                  <img
                    src={pending.previewUrl}
                    alt=""
                    className="size-10 rounded-md object-cover"
                  />
                  <span className="max-w-36 truncate">
                    {pending.sourceLabel ?? "Contexto visual"}
                  </span>
                  <button
                    type="button"
                    className="rounded-md p-0.5 hover:bg-surface-hover"
                    title="Remover contexto"
                    disabled={controlsDisabled}
                    onClick={() => {
                      clearPending();
                      clearCaptureError();
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              replyTarget ? "Escreva sua resposta..." : "Pergunte qualquer coisa..."
            }
            rows={1}
            disabled={controlsDisabled}
            className="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled
                title="Em breve"
                className="text-muted-foreground"
              >
                <Paperclip />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={controlsDisabled}
                      title="Capturar contexto visual"
                      aria-label="Capturar contexto visual"
                      className="text-muted-foreground"
                    />
                  }
                >
                  <SquareDashedMousePointer />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onClick={() => void capture("window")}>
                    <AppWindow />
                    Capturar uma janela
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void capture("monitor")}>
                    <Monitor />
                    Capturar a tela inteira
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ChatToolsMenu
                value={forceTool}
                onChange={setForceTool}
                disabled={controlsDisabled}
              />
              {modelSelectionEnabled ? (
                <ChatModelPicker
                  models={models}
                  value={modelId}
                  onChange={handleModelChange}
                  disabled={controlsDisabled}
                />
              ) : null}
            </div>
            <Button
              size="icon-sm"
              onClick={handleSend}
              disabled={!canSend || resolving}
              title="Enviar"
              className="shrink-0"
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
      ) : captureError ? (
        <p className="mt-2 text-center text-xs text-destructive" role="alert">
          {captureError}
        </p>
      ) : (
        <p className="mt-2.5 text-center font-technical text-[10px] tracking-wide text-muted-foreground/70">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      )}
    </div>
  );
}
