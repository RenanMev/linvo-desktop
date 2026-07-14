import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UserPublic } from "@linvo/shared";

import { emitPanelSession } from "@/lib/panel-session-sync";
import type { StoredTokens } from "@/lib/auth/token-store";

export const PANEL_NAVIGATE_EVENT = "panel://navigate";

export async function openPanel(
  route: string,
  user?: UserPublic,
  tokens?: StoredTokens | null,
): Promise<void> {
  if (user) {
    await emitPanelSession(user, tokens);
  }
  await invoke("panel_open", { route });
}

export async function closePanel(): Promise<void> {
  await invoke("panel_close");
}

export async function isPanelOpen(): Promise<boolean> {
  return invoke<boolean>("panel_is_open");
}

export async function listenPanelNavigate(
  handler: (route: string) => void,
): Promise<() => void> {
  const unlisten = await listen<string>(PANEL_NAVIGATE_EVENT, (event) => {
    handler(event.payload);
  });
  return unlisten;
}
