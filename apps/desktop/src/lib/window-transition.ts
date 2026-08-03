import { getCurrentWindow } from "@tauri-apps/api/window";

import { applyAnchor, isAnchored, type EdgeAnchor } from "@/lib/window-anchor";
import {
  clampToMonitor,
  computeTopCenter,
  isFullyVisibleOnMonitor,
  type MonitorInfo,
  type Position,
  type Size,
} from "@/lib/window-position";
import { EDGE_MARGIN } from "@/lib/window-storage";

/**
 * Redimensiona mantendo o centro, eixo por eixo.
 *
 * Duas regras importantes, ambas por eixo e nunca "tudo ou nada":
 *
 * 1. No eixo ancorado a janela cola na borda; no eixo livre ela cresce/encolhe
 *    a partir do centro. `applyAnchor` sozinho deixava o eixo livre parado na
 *    posição anterior — com a barra no topo, o painel (mais largo que a pílula)
 *    abria todo para a direita em vez de centralizado sob ela.
 * 2. O clamp é aplicado por eixo no fim. A versão anterior descartava a
 *    centralização inteira quando o resultado não caberia na tela, então perto
 *    do topo o eixo horizontal também perdia o alinhamento.
 *
 * Expand e collapse usam esta mesma função, o que as torna inversas exatas —
 * é o que evita a pílula voltar num lugar diferente ao fechar o chat.
 */
function resizeAroundCenter(input: {
  currentPosition: Position;
  currentSize: Size;
  targetSize: Size;
  monitor: MonitorInfo;
  anchor?: EdgeAnchor;
}): Position {
  const { currentPosition, currentSize, targetSize, monitor, anchor } = input;

  let x = Math.round(
    currentPosition.x + (currentSize.width - targetSize.width) / 2,
  );
  let y = Math.round(
    currentPosition.y + (currentSize.height - targetSize.height) / 2,
  );

  if (anchor?.horizontal === "left") {
    x = monitor.position.x;
  } else if (anchor?.horizontal === "right") {
    x = monitor.position.x + monitor.size.width - targetSize.width;
  }

  if (anchor?.vertical === "top") {
    y = monitor.position.y;
  } else if (anchor?.vertical === "bottom") {
    y = monitor.position.y + monitor.size.height - targetSize.height;
  }

  return clampToMonitor({ x, y }, targetSize, monitor);
}

export function resolveExpandPlan(input: {
  currentPosition: Position;
  currentSize: Size;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): { moveFirst: Position | null; finalPosition: Position } {
  const { currentPosition, currentSize, targetSize, monitor, anchor } = input;

  if (!monitor) {
    return { moveFirst: null, finalPosition: currentPosition };
  }

  const visibleNow = isFullyVisibleOnMonitor(
    currentPosition,
    currentSize,
    monitor,
  );

  const moveFirst = visibleNow
    ? null
    : clampToMonitor(currentPosition, currentSize, monitor);

  const basePosition = moveFirst ?? currentPosition;
  const finalPosition = resizeAroundCenter({
    currentPosition: basePosition,
    currentSize,
    targetSize,
    monitor,
    anchor: anchor && isAnchored(anchor) ? anchor : undefined,
  });

  return { moveFirst, finalPosition };
}

export function resolveCollapsePosition(input: {
  currentPosition: Position;
  currentSize?: Size;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): Position {
  const { currentPosition, currentSize, targetSize, monitor, anchor } = input;
  if (!monitor) {
    return currentPosition;
  }
  if (currentSize) {
    // Mesma regra do expand — garante que a pílula volte exatamente de onde saiu.
    return resizeAroundCenter({
      currentPosition,
      currentSize,
      targetSize,
      monitor,
      anchor: anchor && isAnchored(anchor) ? anchor : undefined,
    });
  }
  if (anchor && isAnchored(anchor)) {
    return applyAnchor({
      anchor,
      size: targetSize,
      workArea: monitor,
      previousPosition: currentPosition,
    });
  }
  if (isFullyVisibleOnMonitor(currentPosition, targetSize, monitor)) {
    return currentPosition;
  }
  return computeTopCenter(monitor, targetSize, EDGE_MARGIN);
}

let animationChain: Promise<void> = Promise.resolve();

export function enqueueWindowAnimation<T>(
  task: () => Promise<T>,
): Promise<T> {
  const next = animationChain.then(task, task);
  animationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export { getCurrentWindow };
