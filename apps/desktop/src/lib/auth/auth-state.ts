import type { UserPublic } from "@linvo/shared";

export type AuthPhase = "checking" | "unauthenticated" | "onboarding" | "floating";

/*
 * Aviso da pílula quando um 401 chega em floating. A sessão caiu, mas a
 * janela fica como está: nada de tela de login em cima do ticket — o
 * atendente entra de novo pela própria ilha (ver `reauthenticate`).
 */
export const SESSION_EXPIRED_WARNING = "Sua sessão expirou";

export type AuthUIState = {
  phase: AuthPhase;
  user: UserPublic | null;
  error: string | null;
  sessionWarning: string | null;
};

export type AuthAction =
  | { type: "BOOT_START" }
  | { type: "BOOT_NO_TOKEN" }
  | { type: "BOOT_SUCCESS"; user: UserPublic }
  | { type: "BOOT_NETWORK_ERROR" }
  | { type: "BOOT_SESSION_INVALID" }
  | { type: "LOGIN_SUCCESS"; user: UserPublic }
  | { type: "REGISTER_SUCCESS"; user: UserPublic }
  | { type: "START_ONBOARDING"; user: UserPublic }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "START_FLOATING" }
  | { type: "LOGOUT" }
  | { type: "UNAUTHORIZED" }
  | { type: "SESSION_EXPIRED" }
  | { type: "SESSION_RESTORED"; user: UserPublic };

export const initialAuthState: AuthUIState = {
  phase: "checking",
  user: null,
  error: null,
  sessionWarning: null,
};

export function authReducer(
  state: AuthUIState,
  action: AuthAction,
): AuthUIState {
  switch (action.type) {
    case "BOOT_START":
      return {
        ...state,
        phase: "checking",
        error: null,
        sessionWarning: null,
      };
    case "BOOT_NO_TOKEN":
      return {
        phase: "unauthenticated",
        user: null,
        error: null,
        sessionWarning: null,
      };
    case "BOOT_SUCCESS":
    case "LOGIN_SUCCESS":
    case "REGISTER_SUCCESS":
      return {
        phase: "floating",
        user: action.user,
        error: null,
        sessionWarning: null,
      };
    case "START_ONBOARDING":
      return {
        phase: "onboarding",
        user: action.user,
        error: null,
        sessionWarning: null,
      };
    case "BOOT_NETWORK_ERROR":
      return {
        phase: "unauthenticated",
        user: null,
        error: null,
        sessionWarning: "Não foi possível validar sua sessão",
      };
    case "BOOT_SESSION_INVALID":
      return {
        phase: "unauthenticated",
        user: null,
        error: null,
        sessionWarning: null,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.error,
      };
    case "START_FLOATING":
      return {
        ...state,
        phase: "floating",
      };
    case "LOGOUT":
    case "UNAUTHORIZED":
      return {
        phase: "unauthenticated",
        user: null,
        error: null,
        sessionWarning: null,
      };
    case "SESSION_EXPIRED":
      // Só faz sentido em floating; fora dela é o mesmo que UNAUTHORIZED.
      if (state.phase !== "floating" || !state.user) {
        return {
          phase: "unauthenticated",
          user: null,
          error: null,
          sessionWarning: null,
        };
      }
      return {
        ...state,
        error: null,
        sessionWarning: SESSION_EXPIRED_WARNING,
      };
    case "SESSION_RESTORED":
      return {
        phase: "floating",
        user: action.user,
        error: null,
        sessionWarning: null,
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function isAuthWindowPhase(phase: AuthPhase): boolean {
  return phase === "unauthenticated" || phase === "checking" || phase === "onboarding";
}
