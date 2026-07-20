import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useWindowMaximized() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let disposed = false;

    void win.isMaximized().then((value) => {
      if (!disposed) {
        setMaximized(value);
      }
    });

    const unlistenPromise = win.onResized(async () => {
      const value = await win.isMaximized();
      if (!disposed) {
        setMaximized(value);
      }
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const toggleMaximize = useCallback(async () => {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    setMaximized(await win.isMaximized());
  }, []);

  return { maximized, toggleMaximize };
}
