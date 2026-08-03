import { useEffect, useRef } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";

import {
  applyAnchor,
  isAnchored,
  NO_ANCHOR,
  resolveSnap,
} from "@/lib/window-anchor";
import { applyWindowBoundsWithFallback } from "@/lib/window-animation";
import { clampToMonitor, computeTopCenter, type Position } from "@/lib/window-position";
import {
  EDGE_MARGIN,
  loadSavedAnchor,
  loadSavedPosition,
  POSITION_STORAGE_KEY,
  saveSavedAnchor,
  saveSavedPosition,
  SNAP_THRESHOLD,
} from "@/lib/window-storage";
import { readWorkArea } from "@/lib/window-work-area";

/** Silêncio após o último `onMoved` que conta como "soltou o arraste". */
const SNAP_SILENCE_MS = 180;
const SNAP_ANIMATION_DURATION_MS = 160;

type UseWindowPositionOptions = {
  shouldPersist: () => boolean;
  enabled?: boolean;
  storageKey?: string;
  snapToEdges?: boolean;
};

export function useWindowPosition({
  shouldPersist,
  enabled = true,
  storageKey = POSITION_STORAGE_KEY,
  snapToEdges = true,
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
    let snapTimer: ReturnType<typeof setTimeout> | undefined;
    let suppressed = false;

    async function restore() {
      if (hasRestoredRef.current) {
        return;
      }
      hasRestoredRef.current = true;

      const workArea = await readWorkArea();
      const outer = await win.outerSize();
      const winSize = { width: outer.width, height: outer.height };
      const saved = loadSavedPosition(storageKey);
      const savedAnchor = snapToEdges ? loadSavedAnchor() : null;

      let target: Position;
      if (saved) {
        target = workArea
          ? savedAnchor && isAnchored(savedAnchor)
            ? applyAnchor({
                anchor: savedAnchor,
                size: winSize,
                workArea,
                previousPosition: saved,
              })
            : clampToMonitor(saved, winSize, workArea)
          : saved;
      } else if (workArea) {
        target = computeTopCenter(workArea, winSize, EDGE_MARGIN);
      } else {
        target = { x: EDGE_MARGIN, y: EDGE_MARGIN };
      }

      if (!disposed) {
        await win.setPosition(new PhysicalPosition(target.x, target.y));
      }
    }

    async function resolveSnapAndPersist() {
      if (!persistRef.current() || disposed) {
        return;
      }

      if (!snapToEdges) {
        const position = await win.outerPosition();
        if (!disposed && persistRef.current()) {
          saveSavedPosition({ x: position.x, y: position.y }, storageKey);
        }
        return;
      }

      const [position, size, workArea] = await Promise.all([
        win.outerPosition(),
        win.outerSize(),
        readWorkArea(),
      ]);

      if (disposed || !persistRef.current()) {
        return;
      }

      const currentPosition = { x: position.x, y: position.y };
      const currentSize = { width: size.width, height: size.height };

      if (!workArea) {
        saveSavedPosition(currentPosition, storageKey);
        saveSavedAnchor(NO_ANCHOR);
        return;
      }

      const snap = resolveSnap({
        position: currentPosition,
        size: currentSize,
        workArea,
        threshold: SNAP_THRESHOLD,
      });

      if (!isAnchored(snap.anchor)) {
        saveSavedPosition(currentPosition, storageKey);
        saveSavedAnchor(NO_ANCHOR);
        return;
      }

      suppressed = true;
      try {
        await applyWindowBoundsWithFallback(
          win,
          { position: snap.position, size: currentSize },
          { durationMs: SNAP_ANIMATION_DURATION_MS },
        );
      } finally {
        suppressed = false;
      }

      if (disposed) {
        return;
      }

      saveSavedPosition(snap.position, storageKey);
      saveSavedAnchor(snap.anchor);
    }

    async function subscribe() {
      unlisten = await win.onMoved(() => {
        if (suppressed) {
          return;
        }
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
          void resolveSnapAndPersist();
        }, SNAP_SILENCE_MS);
      });
    }

    restore().then(subscribe);

    return () => {
      disposed = true;
      if (snapTimer) clearTimeout(snapTimer);
      unlisten?.();
    };
  }, [enabled, snapToEdges, storageKey]);
}
