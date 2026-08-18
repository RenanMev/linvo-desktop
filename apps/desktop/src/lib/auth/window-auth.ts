import type { Size } from "@/lib/window-position";
import { ONBOARDING_SIZE } from "@/lib/window-mode";

export const AUTH_SIZE: Size = { width: 440, height: 620 };

export type WindowSurfaceMode = "auth" | "onboarding" | "compact";

export type WindowSurfaceConfig = {
  mode: WindowSurfaceMode;
  size: Size;
  decorations: boolean;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  resizable: boolean;
  maximizable: boolean;
  transparent: boolean;
};

export function configForSurfaceMode(mode: WindowSurfaceMode): WindowSurfaceConfig {
  switch (mode) {
    case "auth":
      return {
        mode,
        size: AUTH_SIZE,
        decorations: false,
        alwaysOnTop: false,
        skipTaskbar: false,
        resizable: true,
        maximizable: false,
        transparent: true,
      };
    case "onboarding":
      return {
        mode,
        size: ONBOARDING_SIZE,
        decorations: false,
        alwaysOnTop: false,
        skipTaskbar: false,
        resizable: false,
        maximizable: false,
        transparent: true,
      };
    case "compact":
      return {
        mode,
        size: { width: 140, height: 40 },
        decorations: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        maximizable: false,
        transparent: true,
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function surfaceModeForAuthPhase(
  phase: "checking" | "unauthenticated" | "onboarding" | "floating",
): WindowSurfaceMode {
  if (phase === "floating") {
    return "compact";
  }
  if (phase === "onboarding") {
    return "onboarding";
  }
  return "auth";
}
