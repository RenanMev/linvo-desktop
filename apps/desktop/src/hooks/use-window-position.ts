import { useEffect, useRef } from "react";
import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
} from "@tauri-apps/api/window";

import {
  clampToMonitor,
  computeTopCenter,
  type MonitorInfo,
  type Position,
} from "@/lib/window-position";
import {
  EDGE_MARGIN,
  loadSavedPosition,
  POSITION_STORAGE_KEY,
  saveSavedPosition,
} from "@/lib/window-storage";

const SAVE_DEBOUNCE_MS = 200;

type UseWindowPositionOptions = {
  shouldPersist: () => boolean;
  enabled?: boolean;
  storageKey?: string;
};

async function readMonitor(): Promise<MonitorInfo | null> {
  const monitor = await currentMonitor();
  if (!monitor) return null;
  return {
    position: { x: monitor.position.x, y: monitor.position.y },
    size: { width: monitor.size.width, height: monitor.size.height },
  };
}

export function useWindowPosition({
  shouldPersist,
  enabled = true,
  storageKey = POSITION_STORAGE_KEY,
}: UseWindowPositionOptions) {
  const persistRef = useRef(shouldPersist);
  persistRef.current = shouldPersist;
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    async function restore() {
      if (hasRestoredRef.current) {
        return;
      }
      hasRestoredRef.current = true;

      const monitor = await readMonitor();
      const outer = await win.outerSize();
      const winSize = { width: outer.width, height: outer.height };
      const saved = loadSavedPosition(storageKey);

      let target: Position;
      if (saved) {
        target = monitor ? clampToMonitor(saved, winSize, monitor) : saved;
      } else if (monitor) {
        target = computeTopCenter(monitor, winSize, EDGE_MARGIN);
      } else {
        target = { x: EDGE_MARGIN, y: EDGE_MARGIN };
      }

      if (!disposed) {
        await win.setPosition(new PhysicalPosition(target.x, target.y));
      }
    }

    async function subscribe() {
      unlisten = await win.onMoved(({ payload }) => {
        if (!persistRef.current()) {
          if (saveTimer) clearTimeout(saveTimer);
          return;
        }
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          if (persistRef.current()) {
            saveSavedPosition({ x: payload.x, y: payload.y }, storageKey);
          }
        }, SAVE_DEBOUNCE_MS);
      });
    }

    restore().then(subscribe);

    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      unlisten?.();
    };
  }, [enabled, storageKey]);
}
