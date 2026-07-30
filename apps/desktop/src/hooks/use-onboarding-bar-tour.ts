import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isRegistered } from "@tauri-apps/plugin-global-shortcut";

import { useWindowChrome } from "@/context/window-chrome-context";
import { GLOBAL_SHORTCUTS } from "@/hooks/use-global-shortcut";

export function useOnboardingBarTour() {
  const { setShortcutOverride } = useWindowChrome();
  const [shortcutDone, setShortcutDone] = useState(false);
  const [dragDone, setDragDone] = useState(false);
  const [shortcutUnavailable, setShortcutUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let unlistenMoved: (() => void) | undefined;

    setShortcutOverride(() => {
      if (active) {
        setShortcutDone(true);
      }
    });

    void (async () => {
      let registered = false;
      for (const shortcut of GLOBAL_SHORTCUTS) {
        try {
          if (await isRegistered(shortcut)) {
            registered = true;
            break;
          }
        } catch {
          continue;
        }
      }
      if (active && !registered) {
        setShortcutUnavailable(true);
      }
    })();

    void getCurrentWindow()
      .onMoved(() => {
        if (active) {
          setDragDone(true);
        }
      })
      .then((unlisten) => {
        if (active) {
          unlistenMoved = unlisten;
        } else {
          unlisten();
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      unlistenMoved?.();
      setShortcutOverride(null);
    };
  }, [setShortcutOverride]);

  return {
    shortcutDone,
    dragDone,
    shortcutUnavailable,
  };
}
