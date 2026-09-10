import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

import { toggleAppVisibility } from "@/lib/app-windows";

export const GLOBAL_SHORTCUTS = [
  "CommandOrControl+Shift+L",
  "CmdOrControl+Shift+L",
  "Ctrl+Shift+L",
] as const;

export const CAPTURE_AND_ASK_SHORTCUTS = [
  "CommandOrControl+Shift+C",
  "CmdOrControl+Shift+C",
  "Ctrl+Shift+C",
] as const;

type UseGlobalShortcutOptions = {
  enabled?: boolean;
  shortcuts?: readonly string[];
  onTrigger?: () => void;
};

export function useGlobalShortcut({
  enabled = true,
  shortcuts = GLOBAL_SHORTCUTS,
  onTrigger,
}: UseGlobalShortcutOptions = {}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    let registeredShortcut: string | null = null;

    void (async () => {
      for (const shortcut of shortcuts) {
        try {
          await register(shortcut, (event) => {
            if (active && event.state === "Pressed") {
              if (onTrigger) {
                onTrigger();
              } else {
                void toggleAppVisibility({ focus: true });
              }
            }
          });
          registeredShortcut = shortcut;
          return;
        } catch (error) {
          console.warn("Global shortcut registration failed", {
            shortcut,
            error,
          });
        }
      }
      console.warn("No global shortcut could be registered", {
        shortcuts,
      });
    })();

    return () => {
      active = false;
      if (registeredShortcut) {
        void unregister(registeredShortcut).catch(() => undefined);
      }
    };
  }, [enabled, shortcuts]);
}
