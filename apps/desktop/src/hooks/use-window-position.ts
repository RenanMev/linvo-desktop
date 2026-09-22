import { useEffect, useRef } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";

import {
  applyAnchor,
  isAnchored,
  NO_ANCHOR,
  resolveSnap,
} from "@/lib/window-anchor";
import { applyWindowBoundsWithFallback, logicalToPhysical } from "@/lib/window-animation";
import { clampToMonitor, computeTopCenter, type Position } from "@/lib/window-position";
import {
  COMPACT_SIZE,
  envelopePositionForPill,
  pillPositionForEnvelope,
  type IslandGrowthDirection,
} from "@/lib/window-mode";
import {
  EDGE_MARGIN,
  hydrateWindowStorage,
  loadIslandPillPosition,
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
  /**
   * Quando presente, a janela real é o envelope fixo (ver
   * `docs/SDD-ILHA-ENVELOPE.md`) e este hook lê, ancora e persiste a posição
   * da PÍLULA — não a do envelope, que é maior e deslocado dela por um offset
   * que depende da direção de crescimento retornada aqui. A leitura inicial
   * usa `loadIslandPillPosition` (com migração da chave legada); as
   * gravações seguem para `storageKey`, que quem chama deve apontar para
   * `ISLAND_PILL_POSITION_STORAGE_KEY`.
   *
   * Omitido, o hook trata a posição bruta da janela como a própria posição
   * salva — comportamento de antes do envelope, mantido para janelas sem
   * envelope.
   */
  pillGrowth?: () => IslandGrowthDirection;
};

export function useWindowPosition({
  shouldPersist,
  enabled = true,
  storageKey = POSITION_STORAGE_KEY,
  snapToEdges = true,
  pillGrowth,
}: UseWindowPositionOptions) {
  const persistRef = useRef(shouldPersist);
  persistRef.current = shouldPersist;
  const pillGrowthRef = useRef(pillGrowth);
  pillGrowthRef.current = pillGrowth;
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

      await hydrateWindowStorage();
      const growth = pillGrowthRef.current?.();
      const scale = growth ? await win.scaleFactor() : 1;
      const workArea = await readWorkArea();
      const outer = await win.outerSize();
      const winSize = growth
        ? logicalToPhysical(COMPACT_SIZE, scale)
        : { width: outer.width, height: outer.height };
      const saved = growth ? loadIslandPillPosition(scale) : loadSavedPosition(storageKey);
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

      const applyTarget = growth
        ? envelopePositionForPill({ pillPosition: target, growth, scaleFactor: scale })
        : target;

      if (!disposed) {
        await win.setPosition(new PhysicalPosition(applyTarget.x, applyTarget.y));
      }
    }

    async function resolveSnapAndPersist() {
      if (!persistRef.current() || disposed) {
        return;
      }

      const growth = pillGrowthRef.current?.();
      const scale = growth ? await win.scaleFactor() : 1;

      if (!snapToEdges) {
        const position = await win.outerPosition();
        if (!disposed && persistRef.current()) {
          const envelopePosition = { x: position.x, y: position.y };
          const persisted = growth
            ? pillPositionForEnvelope({ envelopePosition, growth, scaleFactor: scale })
            : envelopePosition;
          saveSavedPosition(persisted, storageKey);
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

      const envelopePosition = { x: position.x, y: position.y };
      const realSize = { width: size.width, height: size.height };
      const snapPosition = growth
        ? pillPositionForEnvelope({ envelopePosition, growth, scaleFactor: scale })
        : envelopePosition;
      const snapSize = growth ? logicalToPhysical(COMPACT_SIZE, scale) : realSize;

      if (!workArea) {
        saveSavedPosition(snapPosition, storageKey);
        saveSavedAnchor(NO_ANCHOR);
        return;
      }

      const snap = resolveSnap({
        position: snapPosition,
        size: snapSize,
        workArea,
        threshold: SNAP_THRESHOLD,
      });

      if (!isAnchored(snap.anchor)) {
        saveSavedPosition(snapPosition, storageKey);
        saveSavedAnchor(NO_ANCHOR);
        return;
      }

      const applyPosition = growth
        ? envelopePositionForPill({ pillPosition: snap.position, growth, scaleFactor: scale })
        : snap.position;

      suppressed = true;
      try {
        await applyWindowBoundsWithFallback(
          win,
          { position: applyPosition, size: realSize },
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
