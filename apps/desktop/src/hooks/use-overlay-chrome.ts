import { useEffect } from "react";

import {
  hydrateDesktopSettings,
  loadHideFromCapture,
} from "@/lib/desktop-settings-store";
import {
  overlayChromeStatus,
  setExcludeFromCapture,
  setTopmostGuard,
} from "@/lib/overlay-chrome";

export function useOverlayChrome(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;

    void (async () => {
      await setTopmostGuard(true);
      await hydrateDesktopSettings();
      if (cancelled) {
        return;
      }
      await setExcludeFromCapture(loadHideFromCapture());
      if (cancelled) {
        return;
      }
      await overlayChromeStatus();
    })();

    return () => {
      cancelled = true;
      // Sair do modo flutuante por qualquer caminho desliga o guard; sem isso o
      // loop nativo seguia reafirmando topmost numa janela que não é mais ilha.
      // A exclusão de captura fica: é preferência do usuário, não do modo.
      void setTopmostGuard(false);
    };
  }, [enabled]);
}
