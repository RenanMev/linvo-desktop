import { Outlet } from "react-router-dom";

import { PanelSidebar } from "@/components/panel/panel-sidebar";
import { PanelTitlebar } from "@/components/panel/panel-titlebar";
import { ChatConversationsProvider } from "@/context/chat-conversations-context";
import type { PanelSession } from "@/hooks/use-panel-session";

type PanelShellProps = {
  session: PanelSession;
  sessionReady: boolean;
  sessionError: string | null;
};

export function PanelShell({ session, sessionReady, sessionError }: PanelShellProps) {
  return (
    <ChatConversationsProvider enabled={sessionReady}>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl">
        <PanelTitlebar session={session} />
        {sessionError ? (
          <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {sessionError}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1">
          <PanelSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <Outlet />
          </div>
        </div>
      </div>
    </ChatConversationsProvider>
  );
}
