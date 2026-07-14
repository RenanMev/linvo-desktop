import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UserPublic } from "@linvo/shared";

import { authDebug } from "@/lib/auth/auth-debug";
import {
  getTokens,
  normalizeStoredTokens,
  type StoredTokens,
} from "@/lib/auth/token-store";

export const PANEL_SESSION_EVENT = "panel://session";
const PANEL_LABEL = "panel";

export type PanelSessionPayload = {
  user: UserPublic;
  source: string;
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
};

export function resolvePanelSessionTokens(
  payload: PanelSessionPayload,
): StoredTokens | null {
  return normalizeStoredTokens(payload);
}

export async function emitPanelSession(
  user: UserPublic,
  tokens?: StoredTokens | null,
): Promise<void> {
  const source = getCurrentWindow().label;
  const resolved = tokens ?? (await getTokens());
  authDebug("panel.session.emit", { hasTokens: Boolean(resolved) });
  await emitTo(PANEL_LABEL, PANEL_SESSION_EVENT, {
    user,
    source,
    accessToken: resolved?.accessToken,
    refreshToken: resolved?.refreshToken,
    access_token: resolved?.accessToken,
    refresh_token: resolved?.refreshToken,
  } satisfies PanelSessionPayload);
}

export async function listenPanelSession(
  handler: (payload: PanelSessionPayload) => void,
): Promise<() => void> {
  const self = getCurrentWindow().label;
  const unlisten = await listen<PanelSessionPayload>(PANEL_SESSION_EVENT, (event) => {
    if (event.payload.source === self) {
      return;
    }
    handler(event.payload);
  });
  return unlisten;
}
