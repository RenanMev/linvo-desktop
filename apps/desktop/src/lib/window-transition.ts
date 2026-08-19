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
 * Redimensiona preservando a origem da janela.
 *
 * A janela cresce e encolhe a partir do próprio canto superior esquerdo: o
 * painel abre alinhado à borda esquerda da pílula, não centralizado nela.
 *
 * Centralizar exigia mover a janela no mesmo `SetWindowPos` que a redimensiona
 * (132px físicos para a esquerda, medidos), e a ilha só ficava parada na tela
 * porque o CSS cancelava esse deslocamento via `left: calc(% - px)`. Essa
 * compensação depende de o WebView refazer o layout no mesmo frame do resize;
 * quando ele apresentava um frame com o layout antigo já na posição nova, a
 * pílula saltava ~131px para o lado. Sem movimento não há o que compensar, e a
 * classe inteira desse artefato desaparece.
 *
 * O clamp continua por eixo no fim, e expand e collapse seguem usando esta
 * mesma função — o que as mantém inversas exatas, e é o que faz a pílula voltar
 * exatamente de onde saiu.
 */
function resizeFromOrigin(input: {
  currentPosition: Position;
  currentSize: Size;
  targetSize: Size;
  monitor: MonitorInfo;
  anchor?: EdgeAnchor;
}): Position {
  const { currentPosition, targetSize, monitor, anchor } = input;

  let x = currentPosition.x;
  let y = currentPosition.y;

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
  const finalPosition = resizeFromOrigin({
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
    return resizeFromOrigin({
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
