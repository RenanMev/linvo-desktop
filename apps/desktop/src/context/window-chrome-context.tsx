import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { hideAllWindows } from "@/lib/app-windows";
import type { AuthPhase } from "@/lib/auth/auth-state";
import { closePanel } from "@/lib/panel-window";
import {
  registerTrayHandlers,
  updateTrayAuthState,
} from "@/lib/system-tray";
import type { TrayHandlers } from "@/lib/tray-handlers";
import { resolveCloseAction, type WindowLabel } from "@/lib/window-close";
import { useSystemTray } from "@/hooks/use-system-tray";
import { useGlobalShortcut } from "@/hooks/use-global-shortcut";

type WindowChromeContextValue = {
  windowLabel: WindowLabel;
  registerAuthPhase: (phase: AuthPhase) => void;
  registerTrayHandlers: (handlers: TrayHandlers) => void;
  updateTrayAuthState: typeof updateTrayAuthState;
};

const WindowChromeContext = createContext<WindowChromeContextValue | null>(null);

type WindowChromeProviderProps = {
  children: ReactNode;
  windowLabel: WindowLabel;
};

export function WindowChromeProvider({
  children,
  windowLabel,
}: WindowChromeProviderProps) {
  const authPhaseRef = useRef<AuthPhase>("checking");
  const isMainWindow = windowLabel === "main";

  const registerAuthPhase = useCallback((phase: AuthPhase) => {
    authPhaseRef.current = phase;
  }, []);

  const handleCloseRequest = useCallback(async () => {
    const action = resolveCloseAction({
      windowLabel,
      authPhase: authPhaseRef.current,
    });

    if (action === "close-panel") {
      await closePanel();
      return;
    }

    await hideAllWindows();
  }, [windowLabel]);

  useSystemTray({
    onCloseRequest: handleCloseRequest,
    initTray: isMainWindow,
  });
  useGlobalShortcut({ enabled: isMainWindow });

  const value = useMemo(
    () => ({
      windowLabel,
      registerAuthPhase,
      registerTrayHandlers,
      updateTrayAuthState,
    }),
    [windowLabel, registerAuthPhase],
  );

  return (
    <WindowChromeContext.Provider value={value}>
      {children}
    </WindowChromeContext.Provider>
  );
}

export function useWindowChrome() {
  const context = useContext(WindowChromeContext);
  if (!context) {
    throw new Error("useWindowChrome must be used within WindowChromeProvider");
  }
  return context;
}
