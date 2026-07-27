import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { UserPublic } from "@linvo/shared";

import {
  logout as logoutRequest,
  me as meRequest,
  AuthApiError,
  AuthNetworkError,
} from "@/lib/auth/auth-api";
import { authDebug } from "@/lib/auth/auth-debug";
import { authReducer, initialAuthState } from "@/lib/auth/auth-state";
import { refreshStoredTokens } from "@/lib/auth/http";
import { clearStoredAppearance } from "@/lib/appearance/appearance-store";
import {
  applySyncedTokens,
  clearTokens,
  setTokens,
  waitForStoredTokens,
  type StoredTokens,
} from "@/lib/auth/token-store";
import { emitAuthSync, listenAuthSync, listenTokenSync } from "@/lib/auth-sync";
import {
  listenPanelSession,
  resolvePanelSessionTokens,
} from "@/lib/panel-session-sync";
import { closePanel } from "@/lib/panel-window";
import { clearChatLocalCache } from "@/lib/chat/chat-local-store";
import { clearStoredWorkspaceId } from "@/lib/workspace/workspace-store";

export const PANEL_SESSION_UNAVAILABLE_MESSAGE =
  "Sessão indisponível no painel. Feche e abra o chat ou faça login novamente.";

async function resolveUserFromTokens(
  stored: StoredTokens,
): Promise<UserPublic> {
  try {
    return await meRequest(stored.accessToken);
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) {
      throw error;
    }
  }

  const tokens = await refreshStoredTokens();
  return meRequest(tokens.accessToken);
}

async function persistSessionTokens(tokens: StoredTokens): Promise<void> {
  await setTokens(tokens);
  authDebug("panel.session.tokens", { applied: true });
}

export function usePanelSession() {
  const [state, dispatch] = useReducer(authReducer, {
    ...initialAuthState,
    phase: "unauthenticated",
  });
  const bootstrapInFlightRef = useRef(false);
  const hasUserRef = useRef(false);
  const sessionReceivedRef = useRef(false);
  const pendingTokensRef = useRef<StoredTokens | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  hasUserRef.current = state.user !== null;

  const bootstrapSession = useCallback(
    async (options?: { allowClose?: boolean; tokens?: StoredTokens | null }) => {
      const allowClose = options?.allowClose ?? !hasUserRef.current;

      if (bootstrapInFlightRef.current) {
        return false;
      }

      bootstrapInFlightRef.current = true;
      authDebug("bootstrap.start", { allowClose });

      if (!hasUserRef.current) {
        setSessionReady(false);
        setSessionError(null);
        dispatch({ type: "BOOT_START" });
      }

      try {
        const stored =
          options?.tokens ??
          pendingTokensRef.current ??
          (await waitForStoredTokens());

        if (!stored) {
          authDebug("bootstrap.fail", { reason: "missing_tokens" });
          if (hasUserRef.current) {
            setSessionReady(false);
            setSessionError(PANEL_SESSION_UNAVAILABLE_MESSAGE);
            return false;
          }
          dispatch({ type: "BOOT_NO_TOKEN" });
          if (allowClose) {
            await closePanel();
          }
          return false;
        }

        pendingTokensRef.current = stored;

        try {
          const user = await resolveUserFromTokens(stored);
          dispatch({ type: "BOOT_SUCCESS", user });
          setSessionError(null);
          setSessionReady(true);
          authDebug("bootstrap.ok");
          return true;
        } catch (error) {
          if (error instanceof AuthNetworkError) {
            authDebug("bootstrap.fail", { reason: "network" });
            if (!hasUserRef.current) {
              dispatch({ type: "BOOT_NETWORK_ERROR" });
            } else {
              setSessionReady(false);
              setSessionError(PANEL_SESSION_UNAVAILABLE_MESSAGE);
            }
            return false;
          }
          authDebug("bootstrap.fail", { reason: "session_invalid" });
          if (hasUserRef.current) {
            setSessionReady(false);
            setSessionError(PANEL_SESSION_UNAVAILABLE_MESSAGE);
            return false;
          }
          await clearTokens();
          clearStoredAppearance();
          await emitAuthSync("unauthorized");
          pendingTokensRef.current = null;
          dispatch({ type: "BOOT_SESSION_INVALID" });
          if (allowClose) {
            await closePanel();
          }
          return false;
        }
      } finally {
        bootstrapInFlightRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenPanelSession((payload) => {
      sessionReceivedRef.current = true;
      const tokens = resolvePanelSessionTokens(payload);
      authDebug("panel.session.received", {
        userId: payload.user.id,
        hasTokens: Boolean(tokens),
      });
      dispatch({ type: "BOOT_SUCCESS", user: payload.user });
      setSessionReady(false);
      setSessionError(null);

      void (async () => {
        if (tokens) {
          pendingTokensRef.current = tokens;
          await persistSessionTokens(tokens);
        }
        await bootstrapSession({ allowClose: false, tokens });
      })();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [bootstrapSession]);

  useEffect(() => {
    void (async () => {
      if (sessionReceivedRef.current) {
        return;
      }
      await bootstrapSession();
    })();
  }, [bootstrapSession]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenTokenSync((tokens) => {
      void (async () => {
        pendingTokensRef.current = tokens;
        await applySyncedTokens(tokens);
        if (hasUserRef.current && !sessionReady && !bootstrapInFlightRef.current) {
          await bootstrapSession({ allowClose: false, tokens });
        }
      })();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [bootstrapSession, sessionReady]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenAuthSync((payload) => {
      clearStoredAppearance();
      pendingTokensRef.current = null;
      setSessionReady(false);
      setSessionError(null);
      if (payload.type === "logout") {
        dispatch({ type: "LOGOUT" });
        void closePanel();
        return;
      }
      dispatch({ type: "UNAUTHORIZED" });
      void closePanel();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const logout = useCallback(async () => {
    const stored = pendingTokensRef.current ?? (await waitForStoredTokens());
    if (stored) {
      await logoutRequest(stored.refreshToken);
    }
    await clearTokens();
    clearStoredAppearance();
    pendingTokensRef.current = null;
    await clearChatLocalCache();
    clearStoredWorkspaceId();
    await emitAuthSync("logout");
    dispatch({ type: "LOGOUT" });
    await closePanel();
  }, []);

  return {
    user: state.user,
    isLoading: state.phase === "checking",
    sessionReady,
    sessionError,
    sessionWarning: state.sessionWarning,
    logout,
  };
}

export type PanelSession = {
  user: UserPublic;
  logout: () => Promise<void>;
};
