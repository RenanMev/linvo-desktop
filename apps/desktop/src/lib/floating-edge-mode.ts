import {
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import {
  applyAnchor,
  isAnchored,
  NO_ANCHOR,
  type EdgeAnchor,
} from "@/lib/window-anchor";
import {
  COMPACT_SIZE,
  EDGE_HANDLE_LENGTH,
  EDGE_HANDLE_THICKNESS,
} from "@/lib/window-mode";
import {
  clampToMonitor,
  type MonitorInfo,
  type Position,
  type Size,
} from "@/lib/window-position";
import {
  clearRestoreOrigin,
  loadRestoreOrigin,
  rememberRestoreOrigin,
  resolveRestorePosition,
} from "@/lib/window-restore-origin";
import { loadSavedAnchor, saveSavedAnchor, saveSavedPosition } from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
  resolveCollapsePosition,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";

export const EDGE_COLLAPSE_DURATION_MS = 180;
export const EDGE_EXPAND_DURATION_MS = 200;

/**
 * Tamanho lógico do handle conforme a orientação da borda ancorada:
 * anexo a uma lateral vira uma tira vertical; anexo a topo/base vira
 * uma tira horizontal. Sem âncora (ou em canto) cai no vertical por padrão.
 */
export function edgeHandleSize(anchor: EdgeAnchor): Size {
  if (anchor.horizontal !== null && anchor.vertical === null) {
    return { width: EDGE_HANDLE_THICKNESS, height: EDGE_HANDLE_LENGTH };
  }
  if (anchor.vertical !== null && anchor.horizontal === null) {
    return { width: EDGE_HANDLE_LENGTH, height: EDGE_HANDLE_THICKNESS };
  }
  return { width: EDGE_HANDLE_THICKNESS, height: EDGE_HANDLE_LENGTH };
}

export function resolveEdgeHandleBounds(input: {
  anchor: EdgeAnchor;
  size: Size;
  workArea: MonitorInfo;
  previousPosition: Position;
}): Position {
  return applyAnchor(input);
}

export function resolveNearestAnchor(input: {
  position: Position;
  size: Size;
  workArea: MonitorInfo;
}): EdgeAnchor {
  const { position, size, workArea } = input;
  const edges: Array<{ distance: number; anchor: EdgeAnchor }> = [
    {
      distance: Math.abs(position.x - workArea.position.x),
      anchor: { horizontal: "left", vertical: null },
    },
    {
      distance: Math.abs(
        workArea.position.x +
          workArea.size.width -
          (position.x + size.width),
      ),
      anchor: { horizontal: "right", vertical: null },
    },
    {
      distance: Math.abs(position.y - workArea.position.y),
      anchor: { horizontal: null, vertical: "top" },
    },
    {
      distance: Math.abs(
        workArea.position.y +
          workArea.size.height -
          (position.y + size.height),
      ),
      anchor: { horizontal: null, vertical: "bottom" },
    },
  ];

  return edges.reduce((nearest, edge) =>
    edge.distance < nearest.distance ? edge : nearest,
  ).anchor;
}

export async function collapseToEdge(): Promise<EdgeAnchor | null> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const current = await readWindowBounds(win);
    const workArea = await readWorkArea();

    if (!workArea) {
      return null;
    }

    let anchor = loadSavedAnchor() ?? NO_ANCHOR;
    if (!isAnchored(anchor)) {
      anchor = resolveNearestAnchor({
        position: current.position,
        size: current.size,
        workArea,
      });
      saveSavedAnchor(anchor);
    }

    const targetSize = logicalToPhysical(edgeHandleSize(anchor), scale);
    const position = resolveEdgeHandleBounds({
      anchor,
      size: targetSize,
      workArea,
      // Centrado no eixo livre: `applyAnchor` preserva a coordenada que recebe,
      // então passar a posição crua deixaria o handle alinhado pela ponta
      // esquerda da pílula em vez de nascer onde ela estava.
      previousPosition: {
        x: current.position.x +
          Math.round((current.size.width - targetSize.width) / 2),
        y: current.position.y +
          Math.round((current.size.height - targetSize.height) / 2),
      },
    });

    rememberRestoreOrigin("edge", {
      compactPosition: current.position,
      expandedPosition: position,
      expandedSize: targetSize,
    });

    await applyWindowBoundsWithFallback(
      win,
      { position, size: targetSize },
      { durationMs: EDGE_COLLAPSE_DURATION_MS },
    );

    saveSavedPosition(position);
    return anchor;
  });
}

export async function expandFromEdge(): Promise<void> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(COMPACT_SIZE, scale);
    const current = await readWindowBounds(win);
    const workArea = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;

    // Volta no pixel exato de onde encolheu; só recalcula se algo mexeu no
    // handle (ver a nota de arredondamento em window-restore-origin).
    const restored = resolveRestorePosition({
      origin: loadRestoreOrigin("edge"),
      currentPosition: current.position,
      currentSize: current.size,
    });
    clearRestoreOrigin("edge");

    const position = restored
      ? workArea
        ? clampToMonitor(restored, targetSize, workArea)
        : restored
      : resolveCollapsePosition({
          currentPosition: current.position,
          currentSize: current.size,
          targetSize,
          monitor: workArea,
          anchor,
        });

    await applyWindowBoundsWithFallback(
      win,
      { position, size: targetSize },
      { durationMs: EDGE_EXPAND_DURATION_MS },
    );

    saveSavedPosition(position);
  });
}
