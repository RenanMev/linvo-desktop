import { Outlet } from "react-router";

import {
  DesktopUpdateBanner,
  DesktopUpdateMandatoryModal,
} from "@/components/desktop-update-banner";
import { PanelSidebar } from "@/components/panel/panel-sidebar";
import { PanelTitlebar } from "@/components/panel/panel-titlebar";
import { ChatConversationsProvider } from "@/context/chat-conversations-context";
import { WorkspaceProvider } from "@/context/workspace-context";
import type { PanelSession } from "@/hooks/use-panel-session";
import { useDesktopUpdate } from "@/hooks/use-desktop-update";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useWindowMaximized } from "@/hooks/use-window-maximized";
import { cn } from "@/lib/utils";

type PanelShellProps = {
  session: PanelSession;
  sessionReady: boolean;
  sessionError: string | null;
};

export function PanelShell({ session, sessionReady, sessionError }: PanelShellProps) {
  const { maximized, toggleMaximize } = useWindowMaximized();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const update = useDesktopUpdate(true);

  return (
    <ChatConversationsProvider enabled={sessionReady}>
      <WorkspaceProvider enabled={sessionReady}>
        <div
          className={cn(
            "window-shell-glass relative flex h-full w-full flex-col overflow-hidden text-card-foreground",
            // rounded-lg (8px) e não rounded-premium (12px): o acrylic é
            // recortado pelo DWM (DWMWCP_ROUND), que usa 8px. Um raio maior no
            // CSS deixaria uma casca de vidro aparecendo fora do conteúdo.
            maximized ? "rounded-none border-transparent" : "rounded-lg",
          )}
        >
          <PanelTitlebar
            session={session}
            maximized={maximized}
            onToggleMaximize={toggleMaximize}
            sidebarCollapsed={collapsed}
            onToggleSidebar={toggleCollapsed}
          />
          {sessionError ? (
            <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {sessionError}
            </div>
          ) : null}
          <DesktopUpdateBanner update={update} />
          <div className="flex min-h-0 flex-1">
            <PanelSidebar session={session} collapsed={collapsed} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Outlet />
            </div>
          </div>
          <DesktopUpdateMandatoryModal update={update} />
        </div>
      </WorkspaceProvider>
    </ChatConversationsProvider>
  );
}
