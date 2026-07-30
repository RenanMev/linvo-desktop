import { NO_ANCHOR } from "@/lib/window-anchor";
import {
  applyWindowBoundsWithFallback,
  readWindowBounds,
} from "@/lib/window-animation";
import {
  computeTopCenter,
  type MonitorInfo,
  type Position,
  type Size,
} from "@/lib/window-position";
import {
  EDGE_MARGIN,
  saveSavedAnchor,
  saveSavedPosition,
} from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";

export const RESET_POSITION_DURATION_MS = 180;

/**
 * Posição de repouso da barra: topo centralizado, a mesma que
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
 * Devolve a barra flutuante à posição de repouso e descarta a âncora salva.
 *
 * Quem chama precisa marcar a transição (ver `handleResetPosition`), o que
 * desliga o `useWindowPosition` enquanto a janela se move — sem isso o snap
 * dispararia no `onMoved` e grudaria a barra no topo, já que `EDGE_MARGIN`
 * (24px) cai dentro do `SNAP_THRESHOLD` (40px).
 */
export async function resetFloatingPosition(): Promise<void> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const current = await readWindowBounds(win);
    const workArea = await readWorkArea();
    const target = resolveResetPosition({
      monitor: workArea,
      size: current.size,
    });

    if (!target) {
      return;
    }

    saveSavedAnchor(NO_ANCHOR);
    saveSavedPosition(target);

    await applyWindowBoundsWithFallback(
      win,
      { position: target, size: current.size },
      { durationMs: RESET_POSITION_DURATION_MS },
    );
  });
}
