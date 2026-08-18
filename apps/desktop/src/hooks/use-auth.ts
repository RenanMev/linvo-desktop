import { useCallback, useEffect, useReducer, useRef } from "react";
import type { LoginInput, RegisterInput, UserPublic } from "@linvo/shared";

import {
  login as loginRequest,
  logout as logoutRequest,
  me as meRequest,
  register as registerRequest,
  AuthApiError,
  AuthNetworkError,
} from "@/lib/auth/auth-api";
import {
  authReducer,
  initialAuthState,
  type AuthPhase,
} from "@/lib/auth/auth-state";
import { enterLoggedInDesktop } from "@/lib/auth/enter-logged-in-desktop";
import { applyOnboardingWindowSurface } from "@/lib/auth/onboarding-window-surface";
import { clearStoredAppearance } from "@/lib/appearance/appearance-store";
import { clearChatLocalCache } from "@/lib/chat/chat-local-store";
import { clearStoredWorkspaceId } from "@/lib/workspace/workspace-store";
import {
  clearOnboardingCompleted,
  hasCompletedOnboarding,
  isOnboardingForced,
  markOnboardingCompleted,
} from "@/lib/onboarding/onboarding-store";
import { clearOnboardingProgress } from "@/lib/onboarding/onboarding-progress-store";
import { listenOnboardingReview } from "@/lib/onboarding-review-sync";
import { setUnauthorizedHandler, refreshStoredTokens } from "@/lib/auth/http";
import { clearTokens, getTokens, setTokens, applySyncedTokens } from "@/lib/auth/token-store";
import { applyWindowSurface } from "@/lib/auth/apply-window-surface";
import { surfaceModeForAuthPhase } from "@/lib/auth/window-auth";
import { emitAuthSync, listenAuthSync, listenTokenSync } from "@/lib/auth-sync";
import { notifyDesktopEvent } from "@/lib/desktop-notifications";
import { closePanel } from "@/lib/panel-window";

async function persistSession(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  try {
    await setTokens({ accessToken, refreshToken });
  } catch {
    throw new AuthApiError(
      "Não foi possível salvar a sessão no dispositivo",
      500,
    );
  }
}

async function enterSession(user: UserPublic): Promise<void> {
  await enterLoggedInDesktop(user);
}

export function shouldShowOnboarding(user: UserPublic): boolean {
  return isOnboardingForced() || !hasCompletedOnboarding(user.id);
}

export function useAuth() {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const bootstrappedRef = useRef(false);
  /*
   * Conta quantas vezes a sessão foi invalidada.
   *
   * O boot é uma cadeia de `await`s que não pode ser cancelada, e ele não é o
   * único a validar a sessão: o painel (oculto) roda `usePanelSession` no mesmo
   * start. Quando o refresh token já rodou, um dos dois perde a corrida, limpa
   * os tokens e transmite `unauthorized` — e o boot que já tinha o usuário em
   * mãos seguia adiante abrindo o painel. Comparar a geração antes de assumir a
   * sessão é o que impede uma cadeia obsoleta de reabrir o desktop logado.
   */
  const authEpochRef = useRef(0);

  const invalidateSession = useCallback(() => {
    authEpochRef.current += 1;
  }, []);

  const syncWindow = useCallback(async (phase: AuthPhase) => {
    if (phase === "onboarding") {
      await applyOnboardingWindowSurface();
      return;
    }
    await applyWindowSurface(surfaceModeForAuthPhase(phase));
  }, []);

  const handleUnauthorized = useCallback(() => {
    invalidateSession();
    clearStoredAppearance();
    void (async () => {
      await notifyDesktopEvent("Sessão expirada. Faça login novamente.");
      await closePanel();
      dispatch({ type: "UNAUTHORIZED" });
    })();
  }, [invalidateSession]);

  useEffect(() => {
    void applyWindowSurface("auth");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;

    void (async () => {
      const epoch = authEpochRef.current;
      const isStale = () => authEpochRef.current !== epoch;

      /*
       * Assume a sessão só se ela ainda for a mesma de quando o boot começou.
       * Depois de `enterSession` o painel já pode estar na tela, então uma
       * invalidação que chegou no meio precisa fechá-lo — senão o painel vazio
       * fica atrás da tela de login.
       */
      const finishBoot = async (user: UserPublic) => {
        if (shouldShowOnboarding(user)) {
          dispatch({ type: "START_ONBOARDING", user });
          return;
        }
        dispatch({ type: "BOOT_SUCCESS", user });
        await enterSession(user);
        if (isStale()) {
          await closePanel();
        }
      };

      dispatch({ type: "BOOT_START" });

      const stored = await getTokens();
      if (!stored) {
        dispatch({ type: "BOOT_NO_TOKEN" });
        return;
      }

      try {
        const user = await meRequest(stored.accessToken);
        if (isStale()) {
          return;
        }
        await finishBoot(user);
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) {
          try {
            const tokens = await refreshStoredTokens();
            const user = await meRequest(tokens.accessToken);
            if (isStale()) {
              return;
            }
            await finishBoot(user);
            return;
          } catch (refreshError) {
            if (refreshError instanceof AuthNetworkError) {
              void notifyDesktopEvent("Sem conexão com a API.");
              dispatch({ type: "BOOT_NETWORK_ERROR" });
              return;
            }
            await clearTokens();
            clearStoredAppearance();
            await emitAuthSync("unauthorized");
            dispatch({ type: "BOOT_SESSION_INVALID" });
            return;
          }
        }

        if (error instanceof AuthNetworkError) {
          void notifyDesktopEvent("Sem conexão com a API.");
          dispatch({ type: "BOOT_NETWORK_ERROR" });
          return;
        }
        await clearTokens();
        clearStoredAppearance();
        await emitAuthSync("unauthorized");
        dispatch({ type: "BOOT_SESSION_INVALID" });
      }
    })();
  }, []);

  useEffect(() => {
    if (state.phase === "checking" || state.phase === "floating") {
      return;
    }
    /*
     * Tela de login e painel não coexistem. Quem invalida a sessão já chama
     * `closePanel`, mas o `hide` pode chegar antes do `show` de um `panel_open`
     * em voo — e aí o painel fica na tela atrás do login. Reconciliar pela fase
     * fecha o painel independentemente da ordem em que as duas chamadas caíram.
     */
    if (state.phase === "unauthenticated") {
      void closePanel();
    }
    void syncWindow(state.phase);
  }, [state.phase, syncWindow]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenTokenSync((tokens) => {
      void applySyncedTokens(tokens);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenAuthSync((payload) => {
      invalidateSession();
      if (payload.type === "logout" && state.user) {
        clearOnboardingProgress(state.user.id);
      }
      clearStoredAppearance();
      void closePanel();
      dispatch({
        type: payload.type === "logout" ? "LOGOUT" : "UNAUTHORIZED",
      });
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [invalidateSession, state.user]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listenOnboardingReview(() => {
      if (!state.user || state.phase === "onboarding") {
        return;
      }
      clearOnboardingCompleted(state.user.id);
      dispatch({ type: "START_ONBOARDING", user: state.user });
    }).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [state.phase, state.user]);

  const login = useCallback(async (input: LoginInput) => {
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const result = await loginRequest(input);
      await persistSession(result.accessToken, result.refreshToken);
      if (shouldShowOnboarding(result.user)) {
        dispatch({ type: "START_ONBOARDING", user: result.user });
      } else {
        dispatch({ type: "LOGIN_SUCCESS", user: result.user });
        await enterSession(result.user);
      }
    } catch (error) {
      const message =
        error instanceof AuthApiError || error instanceof AuthNetworkError
          ? error.message
          : "Erro inesperado";
      dispatch({ type: "SET_ERROR", error: message });
      throw error;
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const result = await registerRequest(input);
      await persistSession(result.accessToken, result.refreshToken);
      if (shouldShowOnboarding(result.user)) {
        dispatch({ type: "START_ONBOARDING", user: result.user });
      } else {
        dispatch({ type: "REGISTER_SUCCESS", user: result.user });
        await enterSession(result.user);
      }
    } catch (error) {
      const message =
        error instanceof AuthApiError || error instanceof AuthNetworkError
          ? error.message
          : "Erro inesperado";
      dispatch({ type: "SET_ERROR", error: message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    invalidateSession();
    if (state.user) {
      clearOnboardingProgress(state.user.id);
    }
    const stored = await getTokens();
    if (stored) {
      await logoutRequest(stored.refreshToken);
    }
    await clearTokens();
    clearStoredAppearance();
    await clearChatLocalCache();
    clearStoredWorkspaceId();
    await emitAuthSync("logout");
    await closePanel();
    dispatch({ type: "LOGOUT" });
  }, [invalidateSession, state.user]);

  const completeOnboarding = useCallback(
    async (route = "/chat") => {
      if (!state.user) {
        return;
      }
      markOnboardingCompleted(state.user.id);
      clearOnboardingProgress(state.user.id);
      dispatch({ type: "START_FLOATING" });
      await enterLoggedInDesktop(state.user, route);
    },
    [state.user],
  );

  return {
    phase: state.phase,
    user: state.user,
    error: state.error,
    sessionWarning: state.sessionWarning,
    isChecking: state.phase === "checking",
    isAuthenticated: state.phase === "floating" && state.user !== null,
    login,
    register,
    logout,
    completeOnboarding,
  };
}
