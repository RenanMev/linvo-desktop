import type { Procedure, UserPublic } from "@linvo/shared";
import { GripVertical, Maximize2, Minus, X } from "lucide-react";
import { useRef, useState } from "react";

import { IslandChat } from "@/components/quick-center/island-chat";
import { IslandReauth } from "@/components/quick-center/island-reauth";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useQuickCenterWorkspace } from "@/hooks/use-quick-center-workspace";
import { loadActiveConversationId, saveActiveConversationId } from "@/lib/chat/active-conversation-store";
import type { AssistContinueRequest } from "@/lib/assist-handoff";
import { getTokens } from "@/lib/auth/token-store";
import { PANEL_HOME_ROUTE } from "@/lib/panel-routes";
import { openPanel } from "@/lib/panel-window";
import { getStoredWorkspaceId } from "@/lib/workspace/workspace-store";

type IslandPanelProps = {
  user: UserPublic;
  apiHealthy: boolean;
  sessionWarning: string | null;
  ready?: boolean;
  closing?: boolean;
  captureRequested?: boolean;
  onCaptureRequestConsumed?: () => void;
  onClose: () => void;
  onHide?: () => void;
  onOpenProcedureChecklist?: (procedure: Procedure) => void;
  continueRequest?: AssistContinueRequest | null;
  reauth?: {
    email: string;
    onSubmit: (password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  } | null;
};

export function IslandPanel({
  user,
  apiHealthy,
  sessionWarning,
  ready = false,
  closing = false,
  captureRequested = false,
  onCaptureRequestConsumed,
  onClose,
  onHide,
  onOpenProcedureChecklist,
  continueRequest = null,
  reauth = null,
}: IslandPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatEpoch, setChatEpoch] = useState(0);
  const workspace = useQuickCenterWorkspace(!reauth);

  useFocusTrap(containerRef, { active: !closing });

  function handleOpenInPanel() {
    const workspaceId = getStoredWorkspaceId();
    const conversationId = loadActiveConversationId(
      workspaceId ? { userId: user.id, workspaceId } : null,
    );
    const route = conversationId
      ? `/chat/${conversationId}`
      : PANEL_HOME_ROUTE;
    void getTokens()
      .then((tokens) => openPanel(route, user, tokens))
      .catch(() => undefined);
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
        {reauth ? null : (
          <>
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
          </>
        )}
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

      {reauth ? (
        <IslandReauth
          email={reauth.email}
          onSubmit={reauth.onSubmit}
          onSignOut={reauth.onSignOut}
        />
      ) : (
        <IslandChat
          userId={user.id}
          resetToken={chatEpoch}
          continueRequest={continueRequest}
          disabled={!apiHealthy || Boolean(sessionWarning)}
          autoStartCapture={ready && captureRequested}
          {...(onCaptureRequestConsumed
            ? { onAutoCaptureConsumed: onCaptureRequestConsumed }
            : {})}
          {...(onOpenProcedureChecklist ? { onOpenProcedureChecklist } : {})}
        />
      )}
    </div>
  );
}
