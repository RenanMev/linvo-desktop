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
  envelopePositionForPill,
  EDGE_HANDLE_LENGTH,
  EDGE_HANDLE_THICKNESS,
  ISLAND_ENVELOPE_SIZE,
  pillPositionForEnvelope,
  resolveIslandGrowthDirection,
  type IslandGrowthDirection,
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
import {
  loadSavedAnchor,
  saveIslandPillPosition,
  saveSavedAnchor,
  saveSavedPosition,
} from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
  resolveCollapsePosition,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";
import { applyIslandEnvelopeRegion, applyIslandRegionForMode } from "@/lib/window-region";

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

/**
 * Encolhe o envelope para a tira de borda.
 *
 * `current` já é o envelope inteiro (ver `docs/SDD-ILHA-ENVELOPE.md`), não a
 * pílula — a detecção de âncora e o centro do handle precisam da posição da
 * pílula na tela, não do canto do envelope, senão o handle nasceria deslocado
 * do ponto onde a pílula realmente estava.
 */
export async function collapseToEdge(
  growth: IslandGrowthDirection,
): Promise<EdgeAnchor | null> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const current = await readWindowBounds(win);
    const workArea = await readWorkArea();

    if (!workArea) {
      return null;
    }

    const pillPosition = pillPositionForEnvelope({
      envelopePosition: current.position,
      growth,
      scaleFactor: scale,
    });
    const pillSize = logicalToPhysical(COMPACT_SIZE, scale);

    let anchor = loadSavedAnchor() ?? NO_ANCHOR;
    if (!isAnchored(anchor)) {
      anchor = resolveNearestAnchor({
        position: pillPosition,
        size: pillSize,
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
        x: pillPosition.x + Math.round((pillSize.width - targetSize.width) / 2),
        y: pillPosition.y + Math.round((pillSize.height - targetSize.height) / 2),
      },
    });

    rememberRestoreOrigin("edge", {
      compactPosition: pillPosition,
      expandedPosition: position,
      expandedSize: targetSize,
    });

    await applyWindowBoundsWithFallback(
      win,
      { position, size: targetSize },
      { durationMs: EDGE_COLLAPSE_DURATION_MS },
    );

    // O handle é mais estreito que a janela: recorta para as faixas laterais
    // transparentes não captarem cliques da borda da tela. Retângulo cru, sem
    // offset — a janela agora É exatamente do tamanho do handle, não mais o
    // envelope, então não há centralização a compensar aqui.
    await applyIslandEnvelopeRegion({
      rect: {
        x: 0,
        y: 0,
        width: targetSize.width / scale,
        height: targetSize.height / scale,
      },
      scaleFactor: scale,
      radius: 0,
    });

    saveSavedPosition(position);
    return anchor;
  });
}

/**
 * Inversa de `collapseToEdge`: devolve o envelope, com a pílula no pixel de
 * onde encolheu.
 *
 * A pílula pode estar voltando para qualquer borda de qualquer monitor — a
 * direção de crescimento da vez anterior não vale mais aqui. Ela é
 * recalculada para a posição de pouso, e devolvida para quem chama guardar
 * (ver `resolveIslandGrowthDirection`, resolvida sempre em repouso).
 */
export async function expandFromEdge(): Promise<IslandGrowthDirection> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const pillTargetSize = logicalToPhysical(COMPACT_SIZE, scale);
    const current = await readWindowBounds(win);
    const workArea = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;

    // Volta no pixel exato de onde encolheu; só recalcula se algo mexeu no
    // handle (ver a nota de arredondamento em window-restore-origin).
    const restoredPill = resolveRestorePosition({
      origin: loadRestoreOrigin("edge"),
      currentPosition: current.position,
      currentSize: current.size,
    });
    clearRestoreOrigin("edge");

    const pillPosition = restoredPill
      ? workArea
        ? clampToMonitor(restoredPill, pillTargetSize, workArea)
        : restoredPill
      : resolveCollapsePosition({
          currentPosition: current.position,
          currentSize: current.size,
          targetSize: pillTargetSize,
          monitor: workArea,
          anchor,
        });

    const growth = resolveIslandGrowthDirection({
      pillPosition,
      workArea,
      scaleFactor: scale,
    });

    const envelopeTargetSize = logicalToPhysical(ISLAND_ENVELOPE_SIZE, scale);
    let envelopePosition = envelopePositionForPill({
      pillPosition,
      growth,
      scaleFactor: scale,
    });
    if (workArea) {
      envelopePosition = clampToMonitor(envelopePosition, envelopeTargetSize, workArea);
    }

    await applyWindowBoundsWithFallback(
      win,
      { position: envelopePosition, size: envelopeTargetSize },
      { durationMs: EDGE_EXPAND_DURATION_MS },
    );

    await applyIslandRegionForMode({ mode: "compact", growth, scaleFactor: scale });

    saveIslandPillPosition(
      pillPositionForEnvelope({ envelopePosition, growth, scaleFactor: scale }),
    );

    return growth;
  });
}
