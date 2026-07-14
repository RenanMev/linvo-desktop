import { invoke } from "@tauri-apps/api/core";

import { authDebug } from "@/lib/auth/auth-debug";
import { emitTokenSync } from "@/lib/auth-sync";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

const TOKEN_RETRY_DELAYS_MS = [0, 50, 100, 200, 400, 500, 300];

type TokenPayloadLike = {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
};

let memoryTokens: StoredTokens | null = null;

function rememberTokens(tokens: StoredTokens): void {
  memoryTokens = tokens;
}

function forgetTokens(): void {
  memoryTokens = null;
}

export function normalizeStoredTokens(
  payload: TokenPayloadLike | null | undefined,
): StoredTokens | null {
  if (!payload) {
    return null;
  }

  const accessToken = payload.accessToken ?? payload.access_token;
  const refreshToken = payload.refreshToken ?? payload.refresh_token;

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

async function readKeychainTokens(): Promise<StoredTokens | null> {
  authDebug("keychain.get");
  const result = await invoke<
    | StoredTokens
    | { access_token: string; refresh_token: string }
    | null
  >("auth_get_tokens");

  return normalizeStoredTokens(result);
}

async function persistTokens(tokens: StoredTokens): Promise<void> {
  await invoke("auth_set_tokens", {
    access: tokens.accessToken,
    refresh: tokens.refreshToken,
  });
}

export async function setTokens(tokens: StoredTokens): Promise<void> {
  rememberTokens(tokens);
  authDebug("keychain.set");
  await persistTokens(tokens);
  await emitTokenSync(tokens);
}

export async function applySyncedTokens(tokens: StoredTokens): Promise<void> {
  rememberTokens(tokens);
  authDebug("keychain.sync.apply");
  try {
    await persistTokens(tokens);
  } catch (error) {
    authDebug("keychain.sync.apply.fail", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function getTokens(): Promise<StoredTokens | null> {
  if (memoryTokens) {
    authDebug("tokens.memory", { hit: true });
    return memoryTokens;
  }

  const fromKeychain = await readKeychainTokens();
  if (fromKeychain) {
    rememberTokens(fromKeychain);
    authDebug("tokens.found", { source: "keychain" });
  }

  return fromKeychain;
}

export async function waitForStoredTokens(): Promise<StoredTokens | null> {
  if (memoryTokens) {
    authDebug("tokens.found", { source: "memory" });
    return memoryTokens;
  }

  for (const delayMs of TOKEN_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const tokens = await getTokens();
    if (tokens) {
      authDebug("tokens.found", { attemptDelayMs: delayMs });
      return tokens;
    }
  }

  authDebug("tokens.missing");
  return null;
}

export async function clearTokens(): Promise<void> {
  forgetTokens();
  authDebug("keychain.clear");
  await invoke("auth_clear_tokens");
}

export function resetTokenStoreForTests(): void {
  forgetTokens();
}
