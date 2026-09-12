import type { Procedure } from "@linvo/shared";
import { GripVertical, Maximize2, Minus, X } from "lucide-react";
import { useRef, useState } from "react";

import { IslandChat } from "@/components/quick-center/island-chat";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useQuickCenterWorkspace } from "@/hooks/use-quick-center-workspace";
import { loadActiveConversationId, saveActiveConversationId } from "@/lib/chat/active-conversation-store";
import { openPanel } from "@/lib/panel-window";
import { getStoredWorkspaceId } from "@/lib/workspace/workspace-store";

type IslandPanelProps = {
  userId: string;
  apiHealthy: boolean;
  sessionWarning: string | null;
  /** Verdadeiro só depois que o morph assenta. */
  ready?: boolean;
  closing?: boolean;
  /** Pedido de recorte vindo do botão "Recorte" da pílula. */
  captureRequested?: boolean;
  onCaptureRequestConsumed?: () => void;
  onClose: () => void;
  onHide?: () => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
};

/**
 * A ilha expandida: cabeçalho próprio mais o chat completo.
 *
 * Substitui o `QuickCenterPanel` no modo quick-menu. A diferença não é de
 * layout, é de substância: o corpo agora é o mesmo `ChatPanel` da janela
 * grande, em vez da UI de pergunta-única que existia antes.
 *
 * Quase tudo que o painel antigo carregava saiu junto: textarea própria, chip
 * de contexto, menu de captura, botão de parar e área de resposta. Não foram
 * removidos — `ChatInput` já traz cada um deles, e melhor (o de captura
 * inclusive com picker e recorte magnético).
 */
export function IslandPanel({
  userId,
  apiHealthy,
  sessionWarning,
  ready = false,
  closing = false,
  captureRequested = false,
  onCaptureRequestConsumed,
  onClose,
  onHide,
  onOpenProcedureChecklist,
}: IslandPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatEpoch, setChatEpoch] = useState(0);
  const workspace = useQuickCenterWorkspace(true);

  /*
   * Ativo já na montagem, não só quando a ilha assenta: o painel monta quando
   * o morph de abertura começa, e sem foco nesse intervalo o `Esc` cai no
   * `body` — fechar logo depois de abrir não funcionaria.
   */
  useFocusTrap(containerRef, { active: !closing });

  /*
   * Abre a janela grande já na conversa atual, lendo o id da mesma chave que
   * `IslandChat` persiste — evita descer o id por props só para isto, e
   * garante que as duas superfícies continuem a MESMA conversa em vez de a
   * janela abrir uma nova.
   *
   * Fecha a ilha em seguida: ela é sempre-no-topo e cobriria a janela que
   * acabou de abrir.
   */
  function handleOpenInPanel() {
    const workspaceId = getStoredWorkspaceId();
    const conversationId = loadActiveConversationId(
      workspaceId ? { userId, workspaceId } : null,
    );
    void openPanel(conversationId ? `/chat/${conversationId}` : "/chat").catch(
      () => undefined,
    );
    onClose();
  }

  function handleNewQuestion() {
    saveActiveConversationId(null);
    setChatEpoch((value) => value + 1);
  }

  return (
    <div
      id="quick-center-panel"
      ref={containerRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
      className="flex h-full min-h-0 w-full flex-col text-card-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Assist"
    >
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
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleNewQuestion}
          className="text-foreground/50 hover:text-foreground"
        >
          Nova pergunta
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleOpenInPanel}
          title="Abrir na janela grande"
          aria-label="Abrir na janela grande"
          className="text-foreground/50 hover:text-foreground"
        >
          <Maximize2 />
        </Button>
        {onHide ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onHide}
            title="Ocultar"
            aria-label="Ocultar"
            className="text-foreground/50 hover:text-foreground"
          >
            <Minus />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          title="Fechar Assist"
          aria-label="Fechar Assist"
          className="text-foreground/50 hover:text-foreground"
        >
          <X />
        </Button>
      </div>

      <IslandChat
        userId={userId}
        resetToken={chatEpoch}
        disabled={!apiHealthy || Boolean(sessionWarning)}
        // Só depois de assentar: armar durante o morph abriria o overlay de
        // recorte por cima de uma janela ainda em movimento.
        autoStartCapture={ready && captureRequested}
        {...(onCaptureRequestConsumed
          ? { onAutoCaptureConsumed: onCaptureRequestConsumed }
          : {})}
        {...(onOpenProcedureChecklist ? { onOpenProcedureChecklist } : {})}
      />
    </div>
  );
}
