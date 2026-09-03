import { NO_ANCHOR } from "@/lib/window-anchor";
import {
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import {
  COMPACT_SIZE,
  envelopePositionForPill,
  resolveIslandGrowthDirection,
  type IslandGrowthDirection,
} from "@/lib/window-mode";
import {
  computeTopCenter,
  type MonitorInfo,
  type Position,
  type Size,
} from "@/lib/window-position";
import {
  EDGE_MARGIN,
  saveIslandPillPosition,
  saveSavedAnchor,
} from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
} from "@/lib/window-transition";
import { applyIslandRegionForMode } from "@/lib/window-region";
import { readWorkArea } from "@/lib/window-work-area";

export const RESET_POSITION_DURATION_MS = 180;

/**
 * Posição de repouso da pílula: topo centralizado, a mesma que
 * `enterFloatingMode` usa quando não existe posição salva.
 */
export function resolveResetPosition(input: {
  monitor: MonitorInfo | null;
  size: Size;
}): Position | null {
  const { monitor, size } = input;
  if (!monitor) {
    return null;
  }
  return computeTopCenter(monitor, size, EDGE_MARGIN);
}

/**
 * Devolve a pílula à posição de repouso e descarta a âncora salva.
 *
 * O alvo é calculado para a pílula, não para o envelope (ver
 * `docs/SDD-ILHA-ENVELOPE.md`) — quem chama precisa marcar a transição (ver
 * `handleResetPosition`), o que desliga o `useWindowPosition` enquanto a
 * janela se move — sem isso o snap dispararia no `onMoved` e grudaria a barra
 * no topo, já que `EDGE_MARGIN` (24px) cai dentro do `SNAP_THRESHOLD` (40px).
 *
 * A direção de crescimento é recalculada para a posição de repouso — topo
 * centralizado quase sempre cabe crescendo para baixo, mas não custa conferir
 * — e devolvida para quem chama guardar. `null` quando não há monitor
 * conhecido (nada é movido nesse caso).
 */
export async function resetFloatingPosition(): Promise<IslandGrowthDirection | null> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const current = await readWindowBounds(win);
    const workArea = await readWorkArea();
    const scale = await win.scaleFactor();
    const pillTargetSize = logicalToPhysical(COMPACT_SIZE, scale);

    const pillTarget = resolveResetPosition({
      monitor: workArea,
      size: pillTargetSize,
    });

    if (!pillTarget) {
      return null;
    }

    const growth = resolveIslandGrowthDirection({
      pillPosition: pillTarget,
      workArea,
      scaleFactor: scale,
    });
    const envelopeTarget = envelopePositionForPill({
      pillPosition: pillTarget,
      growth,
      scaleFactor: scale,
    });

    saveSavedAnchor(NO_ANCHOR);
    saveIslandPillPosition(pillTarget);

    await applyWindowBoundsWithFallback(
      win,
      { position: envelopeTarget, size: current.size },
      { durationMs: RESET_POSITION_DURATION_MS },
    );
    await applyIslandRegionForMode({ mode: "compact", growth, scaleFactor: scale });

    return growth;
  });
}
