import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { initSystemTray } from "@/lib/system-tray";

type UseSystemTrayOptions = {
  onCloseRequest: () => void | Promise<void>;
  initTray?: boolean;
};

export function useSystemTray({
  onCloseRequest,
  initTray = true,
}: UseSystemTrayOptions) {
  const onCloseRequestRef = useRef(onCloseRequest);
  onCloseRequestRef.current = onCloseRequest;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void (async () => {
      if (initTray) {
        await initSystemTray();
      }

      unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        await onCloseRequestRef.current();
      });
    })();

    return () => {
      void unlisten?.();
    };
  }, [initTray]);
}
