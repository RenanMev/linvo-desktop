import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

import { toggleAppVisibility } from "@/lib/app-windows";

export const GLOBAL_SHORTCUTS = [
  "CommandOrControl+Shift+L",
  "CmdOrControl+Shift+L",
  "Ctrl+Shift+L",
] as const;

type UseGlobalShortcutOptions = {
  enabled?: boolean;
  onTrigger?: () => void;
};

export function useGlobalShortcut({
  enabled = true,
  onTrigger,
}: UseGlobalShortcutOptions = {}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    let registeredShortcut: string | null = null;

    void (async () => {
      for (const shortcut of GLOBAL_SHORTCUTS) {
        try {
          await register(shortcut, (event) => {
            if (active && event.state === "Pressed") {
              if (onTrigger) {
                onTrigger();
              } else {
                void toggleAppVisibility();
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
        shortcuts: GLOBAL_SHORTCUTS,
      });
    })();

    return () => {
      active = false;
      if (registeredShortcut) {
        void unregister(registeredShortcut).catch(() => undefined);
      }
    };
    // `onTrigger` fica de fora do array de deps de propósito: o consumidor
    // (WindowChromeProvider) passa uma função estável que lê de um ref, para
    // trocar o comportamento sem re-registrar o atalho no SO a cada troca.
  }, [enabled]);
}
