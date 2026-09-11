import type { UserPublic } from "@linvo/shared";

import type { AuthPhase } from "@/lib/auth/auth-state";

export type TrayHandlers = {
  logoutAndQuit: () => Promise<void>;
  openChat: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  openSettings: () => Promise<void>;
};

export type TrayAppState = {
  phase: AuthPhase;
  user: UserPublic | null;
};

export const defaultTrayHandlers: TrayHandlers = {
  logoutAndQuit: async () => {},
  openChat: async () => {},
  openWorkspace: async () => {},
  openSettings: async () => {},
};

export function createFloatingTrayHandlers(deps: {
  expandAssist: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  openSettings?: () => Promise<void>;
  logoutAndQuit?: () => Promise<void>;
}): TrayHandlers {
  return {
    openChat: deps.expandAssist,
    openWorkspace: deps.openWorkspace,
    openSettings: deps.openSettings ?? (async () => {}),
    logoutAndQuit: deps.logoutAndQuit ?? (async () => {}),
  };
}
