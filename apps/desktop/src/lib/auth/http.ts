import { WORKSPACE_ID_HEADER } from "@linvo/shared";

import * as authApi from "@/lib/auth/auth-api";
import { refresh as refreshTokens } from "@/lib/auth/auth-api";
import { authDebug } from "@/lib/auth/auth-debug";
import { emitAuthSync } from "@/lib/auth-sync";
import {
  clearTokens,
  getTokens,
  setTokens,
  type StoredTokens,
} from "@/lib/auth/token-store";
import { getStoredWorkspaceId } from "@/lib/workspace/workspace-store";

export type UnauthorizedHandler = () => void | Promise<void>;

export type OnUnauthorizedMode = "logout" | "throw";

export type AuthorizedFetchOptions = {
  onUnauthorized?: OnUnauthorizedMode;
};

let unauthorizedHandler: UnauthorizedHandler | null = null;
let refreshInFlight: Promise<StoredTokens> | null = null;
let unauthorizedInFlight = false;

const TOKEN_RETRY_DELAYS_MS = [0, 50, 100, 200, 400, 500, 300];

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function tokensChanged(
  previous: StoredTokens,
  next: StoredTokens | null,
): next is StoredTokens {
  if (!next) {
    return false;
  }

  return (
    next.accessToken !== previous.accessToken ||
    next.refreshToken !== previous.refreshToken
  );
}

async function waitForStoredTokens(): Promise<StoredTokens | null> {
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

async function handleUnauthorized(reason: string) {
  if (unauthorizedInFlight) {
    return;
  }

  unauthorizedInFlight = true;
  authDebug("unauthorized.trigger", { reason });
  try {
    await clearTokens();
    await emitAuthSync("unauthorized");
    await unauthorizedHandler?.();
  } finally {
    unauthorizedInFlight = false;
  }
}

async function failUnauthorized(
  mode: OnUnauthorizedMode,
  reason: string,
): Promise<never> {
  if (mode === "throw") {
    authDebug("unauthorized.throw", { reason });
    throw new authApi.AuthApiError("Não autenticado", 401);
  }

  await handleUnauthorized(reason);
  throw new authApi.AuthApiError("Não autenticado", 401);
}

async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const workspaceId = getStoredWorkspaceId();
  if (workspaceId) {
    headers.set(WORKSPACE_ID_HEADER, workspaceId);
  }

  try {
    return await fetch(input, { ...init, headers });
  } catch {
    throw new authApi.AuthNetworkError();
  }
}

export async function refreshStoredTokens(): Promise<StoredTokens> {
  if (refreshInFlight) {
    authDebug("refresh.wait");
    return refreshInFlight;
  }

  authDebug("refresh.start");

  refreshInFlight = (async () => {
    const stored = await waitForStoredTokens();
    if (!stored?.refreshToken) {
      authDebug("refresh.fail", { reason: "missing_refresh_token" });
      throw new authApi.AuthApiError("Não autenticado", 401);
    }

    try {
      const renewed = await refreshTokens(stored.refreshToken);
      const tokens = {
        accessToken: renewed.accessToken,
        refreshToken: renewed.refreshToken,
      };
      await setTokens(tokens);
      authDebug("refresh.ok");
      return tokens;
    } catch (error) {
      if (error instanceof authApi.AuthApiError && error.status === 401) {
        const latest = await getTokens();
        if (tokensChanged(stored, latest)) {
          authDebug("refresh.recover", { reason: "tokens_synced_from_other_window" });
          return latest;
        }
      }

      authDebug("refresh.fail", {
        reason:
          error instanceof authApi.AuthApiError
            ? `status_${error.status}`
            : "unknown",
      });
      throw error;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: AuthorizedFetchOptions = {},
): Promise<Response> {
  const onUnauthorized = options.onUnauthorized ?? "logout";
  const url = resolveFetchUrl(input);

  const tokens = await waitForStoredTokens();
  if (!tokens) {
    return failUnauthorized(onUnauthorized, "missing_tokens");
  }

  authDebug("fetch.start", { url, onUnauthorized });

  let response = await fetchWithAuth(input, init, tokens.accessToken);

  authDebug("fetch.response", { url, status: response.status });

  if (response.status !== 401) {
    return response;
  }

  authDebug("fetch.401", { url });

  try {
    await refreshStoredTokens();
  } catch (error) {
    if (error instanceof authApi.AuthApiError && error.status === 401) {
      const latest = await getTokens();
      if (tokensChanged(tokens, latest)) {
        authDebug("fetch.recover", { reason: "tokens_synced_from_other_window" });
        response = await fetchWithAuth(input, init, latest.accessToken);
        authDebug("fetch.response", {
          url,
          status: response.status,
          recover: true,
        });
        if (response.status !== 401) {
          return response;
        }
      }
      return failUnauthorized(onUnauthorized, "refresh_failed");
    }
    throw error;
  }

  const current = await waitForStoredTokens();
  if (!current) {
    return failUnauthorized(onUnauthorized, "missing_tokens_after_refresh");
  }

  response = await fetchWithAuth(input, init, current.accessToken);

  authDebug("fetch.response", { url, status: response.status, retry: true });

  if (response.status === 401) {
    return failUnauthorized(onUnauthorized, "retry_still_401");
  }

  return response;
}
