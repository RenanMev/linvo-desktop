import type { Size } from "@/lib/window-position";

export const AUTH_SIZE: Size = { width: 880, height: 600 };

export type WindowSurfaceMode = "auth" | "compact";

export type WindowSurfaceConfig = {
  mode: WindowSurfaceMode;
  size: Size;
  decorations: boolean;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  resizable: boolean;
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
        transparent: true,
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function surfaceModeForAuthPhase(
  phase: "checking" | "unauthenticated" | "floating",
): WindowSurfaceMode {
  return phase === "floating" ? "compact" : "auth";
}
