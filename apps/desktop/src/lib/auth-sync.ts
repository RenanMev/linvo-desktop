import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { authDebug } from "@/lib/auth/auth-debug";
import {
  normalizeStoredTokens,
  type StoredTokens,
} from "@/lib/auth/token-store";

export const AUTH_SYNC_EVENT = "auth://sync";
export const TOKEN_SYNC_EVENT = "auth://tokens";

export type AuthSyncType = "logout" | "unauthorized";

export type AuthSyncPayload = {
  type: AuthSyncType;
  source: string;
};

export type TokenSyncPayload = {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
  source: string;
};

export async function emitAuthSync(type: AuthSyncType): Promise<void> {
  const source = (await getCurrentWindow()).label;
  authDebug("sync.emit", { type, source });
  await emit(AUTH_SYNC_EVENT, { type, source } satisfies AuthSyncPayload);
}

export async function emitTokenSync(tokens: StoredTokens): Promise<void> {
  const source = (await getCurrentWindow()).label;
  authDebug("sync.tokens.emit", { source });
  await emit(TOKEN_SYNC_EVENT, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    source,
  });
}

export async function listenAuthSync(
  handler: (payload: AuthSyncPayload) => void,
): Promise<() => void> {
  const self = (await getCurrentWindow()).label;
  const unlisten = await listen<AuthSyncPayload>(AUTH_SYNC_EVENT, (event) => {
    if (event.payload.source === self) {
      return;
    }
    authDebug("sync.receive", {
      type: event.payload.type,
      source: event.payload.source,
    });
    handler(event.payload);
  });
  return unlisten;
}

export async function listenTokenSync(
  handler: (tokens: StoredTokens) => void,
): Promise<() => void> {
  const self = (await getCurrentWindow()).label;
  const unlisten = await listen<TokenSyncPayload>(TOKEN_SYNC_EVENT, (event) => {
    if (event.payload.source === self) {
      return;
    }

    const tokens = normalizeStoredTokens(event.payload);
    authDebug("sync.tokens.receive", {
      source: event.payload.source,
      hasTokens: Boolean(tokens),
    });

    if (!tokens) {
      return;
    }

    handler(tokens);
  });
  return unlisten;
}
