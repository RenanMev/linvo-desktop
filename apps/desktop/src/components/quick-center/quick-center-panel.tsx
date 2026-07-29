import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
} from "lucide-react";
import type { UserPublic } from "@linvo/shared";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useQuickCenterWorkspace } from "@/hooks/use-quick-center-workspace";
import { useQuickPrompt } from "@/hooks/use-quick-prompt";
import { writeClipboardText } from "@/lib/clipboard";
import { openPanel } from "@/lib/panel-window";
import { cn } from "@/lib/utils";

type QuickCenterPanelProps = {
  apiHealthy: boolean;
  sessionWarning: string | null;
  user: UserPublic;
  /** Só liga foco e busca de workspace depois que a animação de expansão termina. */
  ready: boolean;
  onClose: (options?: { restoreFocus?: boolean }) => void;
  onOpenSettings: () => void;
  onHide: () => void;
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
  onClose,
  onOpenSettings,
  onHide,
}: QuickCenterPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useQuickPrompt();
  const workspace = useQuickCenterWorkspace(ready);

  useFocusTrap(containerRef, {
    active: ready,
    initialFocusRef: inputRef,
  });

  const fieldsDisabled = !apiHealthy || Boolean(sessionWarning);
  const isStreaming = prompt.status === "streaming";

  async function handleClose() {
    if (isStreaming) {
      prompt.stop();
    }
    onClose();
  }

  async function handleSend() {
    const text = inputValue;
    if (!text.trim() || isStreaming) {
      return;
    }
    setInputValue("");
    const accepted = await prompt.send(text);
    if (!accepted) {
      setInputValue((current) => current || text);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
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

  async function handleOpenInChat() {
    if (!prompt.conversationId) {
      return;
    }
    await openPanel(`/chat/${prompt.conversationId}`, user);
    onClose({ restoreFocus: false });
  }

  async function handleOpenSettings() {
    await openPanel("/settings/general", user);
    onOpenSettings();
  }

  async function handleOpenPanel() {
    await openPanel("/chat", user);
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
      className="flex h-full min-h-0 w-full flex-col text-card-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Center"
      aria-busy={isStreaming || prompt.isThinking}
    >
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
          className="flex h-6 shrink-0 cursor-grab items-center rounded-full px-0.5 text-foreground/35 transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="pointer-events-none size-3" />
        </span>
        <div className="min-w-0 flex-1" data-tauri-drag-region>
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
            "placeholder:text-muted-foreground focus-visible:border-hairline-strong focus-visible:ring-2 focus-visible:ring-ring/40",
            "disabled:opacity-50",
          )}
        />

        <div className="flex shrink-0 items-center justify-between">
          {prompt.errorMessage ? (
            <p role="alert" className="text-xs text-destructive">
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
          ) : (
            <span />
          )}

          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => prompt.stop()}
            >
              <Square className="size-3" />
              Parar
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={fieldsDisabled || !inputValue.trim()}
              onClick={() => void handleSend()}
            >
              <Send className="size-3" />
              Enviar
            </Button>
          )}
        </div>

        {(prompt.responseText || prompt.status === "done") && (
          <div className="scrollbar-elegant min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-hairline bg-surface-raise-2 p-2.5">
            <p className="whitespace-pre-wrap text-[13px] leading-snug">
              {prompt.responseText}
            </p>
          </div>
        )}

        {prompt.status === "done" && prompt.responseText && (
          <div className="flex shrink-0 items-center gap-1.5">
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
