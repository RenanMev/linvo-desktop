import { useEffect } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import { PanelShell } from "@/components/panel/panel-shell";
import { AccountSettingsPage } from "@/pages/settings/account-settings-page";
import { GeneralSettingsPage } from "@/pages/settings/general-settings-page";
import { WorkspaceCreatePage } from "@/pages/settings/workspace-create-page";
import { WorkspaceDetailPage } from "@/pages/settings/workspace-detail-page";
import { RuleReviewPage } from "@/pages/settings/rule-review-page";
import { ProcedurePage } from "@/pages/settings/procedure-page";
import { WorkspaceSettingsPage } from "@/pages/settings/workspace-settings-page";
import { ChatPage } from "@/pages/chat-page";
import { usePanelSession } from "@/hooks/use-panel-session";
import { listenPanelNavigate } from "@/lib/panel-window";

function PanelRoutes() {
  const navigate = useNavigate();
  const {
    user,
    isLoading,
    sessionReady,
    sessionError,
    sessionWarning,
    logout,
  } = usePanelSession();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenPanelNavigate((route) => {
      navigate(route.startsWith("/") ? route : `/${route}`);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [navigate]);

  if (isLoading || !user) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background px-6 text-center text-sm text-muted-foreground">
        {isLoading ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            Carregando...
          </>
        ) : sessionWarning ? (
          <p>{sessionWarning}</p>
        ) : null}
      </div>
    );
  }

  const session = { user, logout };

  return (
    <Routes>
      <Route
        element={
          <PanelShell
            session={session}
            sessionReady={sessionReady}
            sessionError={sessionError}
          />
        }
      >
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:conversationId" element={<ChatPage />} />
        <Route
          path="/workspaces"
          element={<Navigate to="/settings/workspace" replace />}
        />
        <Route
          path="/settings"
          element={<Navigate to="/settings/general" replace />}
        />
        <Route path="/settings/general" element={<GeneralSettingsPage />} />
        <Route path="/settings/workspace" element={<WorkspaceSettingsPage />} />
        <Route
          path="/settings/workspace/new"
          element={<WorkspaceCreatePage />}
        />
        <Route
          path="/settings/workspace/:workspaceId"
          element={<WorkspaceDetailPage />}
        />
        <Route
          path="/settings/workspace/:workspaceId/rule-review"
          element={<RuleReviewPage />}
        />
        <Route
          path="/settings/workspace/:workspaceId/procedures"
          element={<ProcedurePage />}
        />
        <Route
          path="/settings/account"
          element={<AccountSettingsPage session={session} />}
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  );
}

export function PanelApp() {
  return (
    <HashRouter>
      <div className="h-full w-full">
        <PanelRoutes />
      </div>
    </HashRouter>
  );
}
