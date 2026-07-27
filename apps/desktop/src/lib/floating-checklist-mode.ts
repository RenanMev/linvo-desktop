import {
  currentMonitor,
  getCurrentWindow,
} from "@tauri-apps/api/window";

import {
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import { CHECKLIST_SIZE, COMPACT_SIZE } from "@/lib/window-mode";
import {
  clampToMonitor,
  computeTopCenter,
  isFullyVisibleOnMonitor,
  type MonitorInfo,
  type Position,
  type Size,
} from "@/lib/window-position";
import { EDGE_MARGIN } from "@/lib/window-storage";

export const CHECKLIST_EXPAND_DURATION_MS = 320;
export const CHECKLIST_COLLAPSE_DURATION_MS = 260;

function toMonitorInfo(
  monitor: NonNullable<Awaited<ReturnType<typeof currentMonitor>>>,
): MonitorInfo {
  return {
    position: { x: monitor.position.x, y: monitor.position.y },
    size: { width: monitor.size.width, height: monitor.size.height },
  };
}

export function resolveChecklistExpandPosition(input: {
  currentPosition: Position;
  currentSize: Size;
  targetSize: Size;
  monitor: MonitorInfo | null;
}): { moveFirst: Position | null; finalPosition: Position } {
  const { currentPosition, currentSize, targetSize, monitor } = input;

  if (!monitor) {
    return { moveFirst: null, finalPosition: currentPosition };
  }

  const visibleNow = isFullyVisibleOnMonitor(
    currentPosition,
    currentSize,
    monitor,
  );

  if (!visibleNow) {
    const safeCompact = clampToMonitor(currentPosition, currentSize, monitor);
    const finalPosition = clampToMonitor(safeCompact, targetSize, monitor);
    return {
      moveFirst: safeCompact,
      finalPosition,
    };
  }

  return {
    moveFirst: null,
    finalPosition: clampToMonitor(currentPosition, targetSize, monitor),
  };
}

export function resolveChecklistCollapsePosition(input: {
  currentPosition: Position;
  targetSize: Size;
  monitor: MonitorInfo | null;
}): Position {
  const { currentPosition, targetSize, monitor } = input;
  if (!monitor) {
    return currentPosition;
  }
  if (isFullyVisibleOnMonitor(currentPosition, targetSize, monitor)) {
    return currentPosition;
  }
  return computeTopCenter(monitor, targetSize, EDGE_MARGIN);
}

let animationChain: Promise<void> = Promise.resolve();

function enqueueWindowAnimation(task: () => Promise<void>): Promise<void> {
  const next = animationChain.then(task, task);
  animationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function expandFloatingToChecklist(): Promise<void> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();

    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(CHECKLIST_SIZE, scale);
    const current = await readWindowBounds(win);
    const monitor = await currentMonitor();
    const monitorInfo = monitor ? toMonitorInfo(monitor) : null;

    const plan = resolveChecklistExpandPosition({
      currentPosition: current.position,
      currentSize: current.size,
      targetSize,
      monitor: monitorInfo,
    });

    if (
      plan.moveFirst &&
      (plan.moveFirst.x !== current.position.x ||
        plan.moveFirst.y !== current.position.y)
    ) {
      await applyWindowBoundsWithFallback(
        win,
        { position: plan.moveFirst, size: current.size },
        { durationMs: 180 },
      );
    }

    const sameSize =
      current.size.width === targetSize.width &&
      current.size.height === targetSize.height;
    const samePos =
      plan.finalPosition.x === (plan.moveFirst ?? current.position).x &&
      plan.finalPosition.y === (plan.moveFirst ?? current.position).y;

    if (sameSize && samePos) {
      return;
    }

    await applyWindowBoundsWithFallback(
      win,
      { position: plan.finalPosition, size: targetSize },
      { durationMs: CHECKLIST_EXPAND_DURATION_MS },
    );
  });
}

export async function collapseChecklistToFloating(): Promise<void> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(COMPACT_SIZE, scale);
    const current = await readWindowBounds(win);
    const monitor = await currentMonitor();
    const monitorInfo = monitor ? toMonitorInfo(monitor) : null;

    const position = resolveChecklistCollapsePosition({
      currentPosition: current.position,
      targetSize,
      monitor: monitorInfo,
    });

    await applyWindowBoundsWithFallback(
      win,
      { position, size: targetSize },
      { durationMs: CHECKLIST_COLLAPSE_DURATION_MS },
    );
  });
}
