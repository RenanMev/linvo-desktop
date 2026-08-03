import type { UserPublic } from "@linvo/shared";

export type AuthPhase = "checking" | "unauthenticated" | "onboarding" | "floating";

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
  | { type: "UNAUTHORIZED" };

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
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function isAuthWindowPhase(phase: AuthPhase): boolean {
  return phase === "unauthenticated" || phase === "checking" || phase === "onboarding";
}
