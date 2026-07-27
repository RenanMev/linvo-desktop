import { Outlet } from "react-router-dom";

import { PanelSidebar } from "@/components/panel/panel-sidebar";
import { PanelTitlebar } from "@/components/panel/panel-titlebar";
import { ChatConversationsProvider } from "@/context/chat-conversations-context";
import { WorkspaceProvider } from "@/context/workspace-context";
import type { PanelSession } from "@/hooks/use-panel-session";
import { useWindowMaximized } from "@/hooks/use-window-maximized";
import { cn } from "@/lib/utils";

type PanelShellProps = {
  session: PanelSession;
  sessionReady: boolean;
  sessionError: string | null;
};

export function PanelShell({ session, sessionReady, sessionError }: PanelShellProps) {
  const { maximized, toggleMaximize } = useWindowMaximized();

  return (
    <ChatConversationsProvider enabled={sessionReady}>
      <WorkspaceProvider enabled={sessionReady}>
        <div
          className={cn(
            "window-shell-glass flex h-full w-full flex-col overflow-hidden text-card-foreground",
            maximized ? "rounded-none border-transparent" : "rounded-premium",
          )}
        >
          <PanelTitlebar
            session={session}
            maximized={maximized}
            onToggleMaximize={toggleMaximize}
          />
          {sessionError ? (
            <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {sessionError}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1">
            <PanelSidebar session={session} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Outlet />
            </div>
          </div>
        </div>
      </WorkspaceProvider>
    </ChatConversationsProvider>
  );
}
