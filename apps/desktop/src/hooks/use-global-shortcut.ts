import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

import { toggleAppVisibility } from "@/lib/app-windows";

const SHORTCUT = "Control+Shift+L";

type UseGlobalShortcutOptions = {
  enabled?: boolean;
};

export function useGlobalShortcut({ enabled = true }: UseGlobalShortcutOptions = {}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    let registered = false;

    void (async () => {
      try {
        await register(SHORTCUT, () => {
          if (active) {
            void toggleAppVisibility();
          }
        });
        registered = true;
      } catch {
        registered = false;
      }
    })();

    return () => {
      active = false;
      if (registered) {
        void unregister(SHORTCUT).catch(() => undefined);
      }
    };
  }, [enabled]);
}
