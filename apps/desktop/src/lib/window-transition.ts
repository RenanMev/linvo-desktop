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

  const finalPosition =
    anchor && isAnchored(anchor)
      ? applyAnchor({
          anchor,
          size: targetSize,
          workArea: monitor,
          previousPosition: basePosition,
        })
      : clampToMonitor(basePosition, targetSize, monitor);

  return { moveFirst, finalPosition };
}

export function resolveCollapsePosition(input: {
  currentPosition: Position;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): Position {
  const { currentPosition, targetSize, monitor, anchor } = input;
  if (!monitor) {
    return currentPosition;
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
