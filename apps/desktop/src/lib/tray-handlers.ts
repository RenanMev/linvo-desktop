import type { UserPublic } from "@linvo/shared";

import type { AuthPhase } from "@/lib/auth/auth-state";

export type TrayHandlers = {
  logoutAndQuit: () => Promise<void>;
  openChat: () => Promise<void>;
  openSettings: () => Promise<void>;
};

export type TrayAppState = {
  phase: AuthPhase;
  user: UserPublic | null;
};

export const defaultTrayHandlers: TrayHandlers = {
  logoutAndQuit: async () => {},
  openChat: async () => {},
  openSettings: async () => {},
};
