import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Check,
  Copy,
  GripVertical,
  Loader2,
  MessageSquarePlus,
  PanelRight,
  Send,
  Settings,
  Square,
  X,
} from "lucide-react";
import type { UserPublic } from "@linvo/shared";

import { CaptureContextChip } from "@/components/chat/capture-context-chip";
import { CaptureMenu } from "@/components/chat/capture-menu";
import { CapturePreviewDialog } from "@/components/chat/capture-preview-dialog";
import { CaptureSourcePicker } from "@/components/chat/capture-source-picker";
import { Button } from "@/components/ui/button";
import { useDisplaySnapshot } from "@/hooks/use-display-snapshot";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useQuickCenterWorkspace } from "@/hooks/use-quick-center-workspace";
import { useQuickPrompt } from "@/hooks/use-quick-prompt";
import { writeClipboardText } from "@/lib/clipboard";
import {
  buildChatHandoffPayload,
  emitChatHandoff,
} from "@/lib/chat/chat-handoff";
import { openPanel } from "@/lib/panel-window";
import { cn } from "@/lib/utils";

type QuickCenterPanelProps = {
  apiHealthy: boolean;
  sessionWarning: string | null;
  user: UserPublic;
  /** Só liga foco e busca de workspace depois que a animação de expansão termina. */
  ready: boolean;
  /** Pode aparecer durante o morph sem ainda ativar foco ou carregamento. */
  visible?: boolean;
  closing?: boolean;
  /**
   * Abrir o recorte magnético assim que o painel estiver pronto, enviar o
   * contexto sozinho e ficar na resposta — atalho da barra compacta.
   */
  autoCaptureAndSend?: boolean;
  onAutoCaptureAndSendConsumed?: () => void;
  onClose: (options?: { restoreFocus?: boolean }) => void;
  onOpenSettings: () => void;
  onHide: () => void;
  onWindowDragStart?: () => void;
  /**
   * Avisa que existe captura em andamento. A janela flutuante fecha ao perder
   * foco, e tanto o seletor do sistema quanto o overlay de recorte roubam o
   * foco — sem essa trava o painel some junto com o contexto já capturado.
   */
  onCaptureActiveChange?: (active: boolean) => void;
};

function statusLabel(apiHealthy: boolean, sessionWarning: string | null) {
  if (sessionWarning) {
    return "Sessão expirada";
  }
  if (!apiHealthy) {
    return "API indisponível";
  }
  return "Online";
}

export function QuickCenterPanel({
  apiHealthy,
  sessionWarning,
  user,
  ready,
  visible = ready,
  closing = false,
  autoCaptureAndSend = false,
  onAutoCaptureAndSendConsumed,
  onClose,
  onOpenSettings,
  onHide,
  onWindowDragStart,
  onCaptureActiveChange,
}: QuickCenterPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCaptureStartedRef = useRef(false);
  const autoSendArmedRef = useRef(autoCaptureAndSend);
  const sawAutoCaptureRef = useRef(false);
  const [inputValue, setInputValue] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useQuickPrompt();
  const workspace = useQuickCenterWorkspace(ready);
  const {
    pending,
    draft,
    isCapturing,
    isCropping,
    pickerOpen,
    error: captureError,
    capture,
    openPicker,
    closePicker,
    captureNativeSource,
    startMagneticCapture,
    confirmDraft,
    discardDraft,
    editPending,
    clear: clearPending,
    clearError: clearCaptureError,
  } = useDisplaySnapshot({ windowLabel: "main" });

  useFocusTrap(containerRef, {
    active: ready && !closing,
    initialFocusRef: inputRef,
  });

  const fieldsDisabled = !apiHealthy || Boolean(sessionWarning);
  const isStreaming = prompt.status === "streaming";
  const hasAttachment = pending?.status === "ready";
  const captureDialogOpen = pickerOpen || Boolean(draft);
  const captureActive = captureDialogOpen || isCapturing || isCropping;
  const controlsDisabled = isStreaming || isCapturing || isCropping;

  const captureActiveChangeRef = useRef(onCaptureActiveChange);
  captureActiveChangeRef.current = onCaptureActiveChange;
  const onAutoCaptureAndSendConsumedRef = useRef(onAutoCaptureAndSendConsumed);
  onAutoCaptureAndSendConsumedRef.current = onAutoCaptureAndSendConsumed;

  useEffect(() => {
    if (autoCaptureAndSend) {
      autoSendArmedRef.current = true;
    }
  }, [autoCaptureAndSend]);

  useEffect(() => {
    captureActiveChangeRef.current?.(captureActive);
  }, [captureActive]);

  // O painel desmonta ao fechar; deixar a trava ligada prenderia a janela aberta.
  useEffect(
    () => () => {
      captureActiveChangeRef.current?.(false);
    },
    [],
  );

  useEffect(() => {
    if (
      !ready ||
      closing ||
      !autoCaptureAndSend ||
      fieldsDisabled ||
      autoCaptureStartedRef.current
    ) {
      return;
    }
    autoCaptureStartedRef.current = true;
    void startMagneticCapture();
  }, [
    autoCaptureAndSend,
    closing,
    fieldsDisabled,
    ready,
    startMagneticCapture,
  ]);

  useEffect(() => {
    if (isCapturing || isCropping) {
      sawAutoCaptureRef.current = true;
    }
  }, [isCapturing, isCropping]);

  async function handleClose() {
    if (isStreaming) {
      prompt.stop();
    }
    onClose();
  }

  const sendPrompt = useCallback(
    async (text: string, clearInput: boolean) => {
      const readyAttachment = pending?.status === "ready" ? pending : null;
      if ((!text.trim() && !readyAttachment) || isStreaming) {
        return;
      }

      const attachment = readyAttachment
        ? {
            file: readyAttachment.file,
            width: readyAttachment.width,
            height: readyAttachment.height,
            previewUrl: readyAttachment.previewUrl,
            ...(readyAttachment.sourceLabel
              ? { sourceLabel: readyAttachment.sourceLabel }
              : {}),
          }
        : undefined;

      if (clearInput) {
        setInputValue("");
      }
      const accepted = await prompt.send(
        text,
        attachment ? { attachment } : undefined,
      );
      if (!accepted) {
        if (clearInput) {
          setInputValue((current) => current || text);
        }
        return;
      }
      /*
       * O anexo só sai depois do aceite: `clearPending` revoga a object URL da
       * miniatura, então descartá-lo otimista deixaria o chip quebrado se o envio
       * falhasse.
       */
      if (attachment) {
        clearPending();
        clearCaptureError();
      }
    },
    [clearCaptureError, clearPending, isStreaming, pending, prompt.send],
  );

  async function handleSend() {
    await sendPrompt(inputValue, true);
  }

  useEffect(() => {
    if (!autoSendArmedRef.current || !autoCaptureStartedRef.current) {
      return;
    }
    if (isCapturing || isCropping || isStreaming || fieldsDisabled) {
      return;
    }

    if (pending?.status === "ready") {
      autoSendArmedRef.current = false;
      onAutoCaptureAndSendConsumedRef.current?.();
      void sendPrompt("", false);
      return;
    }

    if (sawAutoCaptureRef.current) {
      autoSendArmedRef.current = false;
      onAutoCaptureAndSendConsumedRef.current?.();
    }
  }, [
    fieldsDisabled,
    isCapturing,
    isCropping,
    isStreaming,
    pending,
    sendPrompt,
  ]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      if (captureDialogOpen) {
        return;
      }
      event.preventDefault();
      void handleClose();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  function handleContainerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && event.target !== inputRef.current) {
      // Esc pertence ao diálogo de captura enquanto ele estiver aberto.
      if (captureDialogOpen) {
        return;
      }
      event.preventDefault();
      void handleClose();
    }
  }

  async function handleCopy() {
    const ok = await writeClipboardText(prompt.responseText);
    if (ok && mountedRef.current) {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 1500);
    }
  }

  async function emitComposerHandoff() {
    const payload = await buildChatHandoffPayload({
      conversationId: prompt.conversationId,
      draftText: inputValue,
      pending: pending?.status === "ready" ? pending : null,
    });
    if (!payload) {
      return;
    }
    await emitChatHandoff(payload);
  }

  async function handleOpenInChat() {
    if (!prompt.conversationId) {
      return;
    }
    await emitComposerHandoff();
    await openPanel(`/chat/${prompt.conversationId}`, user);
    onClose({ restoreFocus: false });
  }

  async function handleOpenSettings() {
    await openPanel("/settings/general", user);
    onOpenSettings();
  }

  async function handleOpenPanel() {
    await emitComposerHandoff();
    const route = prompt.conversationId
      ? `/chat/${prompt.conversationId}`
      : "/chat";
    await openPanel(route, user);
    onClose({ restoreFocus: false });
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      prompt.reset();
    };
  }, [prompt.reset]);

  return (
    <div
      id="quick-center-panel"
      ref={containerRef}
      onKeyDown={handleContainerKeyDown}
      data-ready={ready ? "true" : "false"}
      data-closing={closing ? "true" : "false"}
      className={cn(
        "quick-center-panel flex h-full min-h-0 w-full flex-col text-card-foreground",
        closing
          ? "quick-center-panel-closing"
          : visible
            ? "quick-center-panel-ready"
            : "quick-center-panel-preopen",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Quick Center"
      aria-busy={isStreaming || prompt.isThinking}
    >
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
            openPicker();
          }}
          onCancel={discardDraft}
        />
      ) : null}

      <CaptureSourcePicker
        open={pickerOpen}
        busy={isCapturing}
        onSelect={(source) => void captureNativeSource(source)}
        onCancel={closePicker}
        onFallback={() => void capture()}
      />

      <span className="sr-only" role="status" aria-live="polite">
        {copied
          ? "Resposta copiada"
          : prompt.isThinking
            ? "Pensando"
            : prompt.status === "done"
              ? "Resposta concluída"
              : ""}
      </span>

      <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-2.5 py-2.5">
        <span
          data-tauri-drag-region
          title="Mover"
          onPointerDown={onWindowDragStart}
          className="flex h-6 shrink-0 cursor-grab items-center rounded-full px-0.5 text-foreground/35 transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="pointer-events-none size-3" />
        </span>
        <div
          className="min-w-0 flex-1"
          data-tauri-drag-region
          onPointerDown={onWindowDragStart}
        >
          <p className="truncate text-sm font-medium tracking-tight">
            {workspace.name ?? "Workspace"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-technical text-[10px] tracking-wide text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full transition-colors duration-300",
              apiHealthy && !sessionWarning
                ? "status-dot-live"
                : "bg-muted-foreground/25",
            )}
          />
          {statusLabel(apiHealthy, sessionWarning)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void handleClose()}
          title="Fechar Quick Center"
          aria-label="Fechar Quick Center"
          className="text-foreground/50 hover:text-foreground"
        >
          <X />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={fieldsDisabled}
          placeholder="Pergunte alguma coisa..."
          aria-label="Pergunta rápida"
          rows={2}
          className={cn(
            "w-full shrink-0 resize-none rounded-lg border border-hairline bg-surface-raise-2 px-2.5 py-2 text-sm outline-none",
            // Foco neutro: a borda de ênfase já basta, sem anel de accent.
            "placeholder:text-muted-foreground focus-visible:border-hairline-strong",
            "disabled:opacity-50",
          )}
        />

        {pending ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <CaptureContextChip
              previewUrl={pending.previewUrl}
              {...(pending.sourceLabel ? { label: pending.sourceLabel } : {})}
              disabled={controlsDisabled}
              onRemove={() => {
                clearPending();
                clearCaptureError();
              }}
              onEdit={editPending}
            />
          </div>
        ) : null}

        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <CaptureMenu
              disabled={fieldsDisabled || controlsDisabled}
              size="icon-xs"
              side="bottom"
              onPickSource={openPicker}
              onMagneticCapture={() => void startMagneticCapture()}
              onSystemPicker={() => void capture("window")}
            />
            {captureError ? (
              <p role="alert" className="truncate text-xs text-destructive">
                {captureError}
              </p>
            ) : prompt.errorMessage ? (
              <p role="alert" className="truncate text-xs text-destructive">
                {prompt.errorMessage}
              </p>
            ) : prompt.isThinking ? (
              <span
                aria-hidden="true"
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Loader2 className="size-3 animate-spin" />
                Pensando...
              </span>
            ) : null}
          </div>

          {isStreaming ? (
            <Button
              key="stop"
              type="button"
              variant="outline"
              size="xs"
              className="quick-center-fade-in"
              onClick={() => prompt.stop()}
            >
              <Square className="size-3" />
              Parar
            </Button>
          ) : (
            <Button
              key="send"
              type="button"
              variant="secondary"
              size="xs"
              className="quick-center-fade-in"
              disabled={
                fieldsDisabled ||
                controlsDisabled ||
                (!inputValue.trim() && !hasAttachment)
              }
              onClick={() => void handleSend()}
            >
              <Send className="size-3" />
              Enviar
            </Button>
          )}
        </div>

        {(prompt.responseText || prompt.status === "done") && (
          <div className="quick-center-fade-in scrollbar-elegant min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-hairline bg-surface-raise-2 p-2.5">
            <p className="whitespace-pre-wrap text-[13px] leading-snug">
              {prompt.responseText}
            </p>
          </div>
        )}

        {prompt.status === "done" && prompt.responseText && (
          <div className="quick-center-fade-in flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void handleCopy()}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void handleOpenInChat()}
            >
              <MessageSquarePlus className="size-3" />
              Abrir no chat
            </Button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-hairline px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void handleOpenSettings()}
          >
            <Settings className="size-3" />
            Configurações
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void handleOpenPanel()}
          >
            <PanelRight className="size-3" />
            Abrir no painel
          </Button>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={onHide}>
          Ocultar
        </Button>
      </div>
    </div>
  );
}
