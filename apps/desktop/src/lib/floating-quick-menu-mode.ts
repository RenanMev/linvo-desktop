import {
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import type { EdgeAnchor } from "@/lib/window-anchor";
import { COMPACT_SIZE, QUICK_MENU_SIZE } from "@/lib/window-mode";
import type { MonitorInfo, Position, Size } from "@/lib/window-position";
import {
  EDGE_MARGIN,
  loadSavedAnchor,
  saveSavedPosition,
} from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
  resolveCollapsePosition,
  resolveExpandPlan,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";

export const QUICK_MENU_EXPAND_DURATION_MS = 220;
export const QUICK_MENU_COLLAPSE_DURATION_MS = 200;

export function resolveQuickMenuSize(input: {
  targetSize: Size;
  monitor: MonitorInfo | null;
  margin: number;
}): Size {
  const { targetSize, monitor, margin } = input;
  if (!monitor) {
    return targetSize;
  }

  return {
    width: Math.min(
      targetSize.width,
      Math.max(1, monitor.size.width - margin * 2),
    ),
    height: Math.min(
      targetSize.height,
      Math.max(1, monitor.size.height - margin * 2),
    ),
  };
}

export function resolveQuickMenuExpandPosition(input: {
  currentPosition: Position;
  currentSize: Size;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): { moveFirst: Position | null; finalPosition: Position } {
  return resolveExpandPlan(input);
}

export function resolveQuickMenuCollapsePosition(input: {
  currentPosition: Position;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): Position {
  return resolveCollapsePosition(input);
}

export async function expandFloatingToQuickMenu(): Promise<void> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();

    const scale = await win.scaleFactor();
    const requestedSize = logicalToPhysical(QUICK_MENU_SIZE, scale);
    const current = await readWindowBounds(win);
    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;
    const targetSize = resolveQuickMenuSize({
      targetSize: requestedSize,
      monitor: monitorInfo,
      margin: Math.round(EDGE_MARGIN * scale),
    });

    const plan = resolveQuickMenuExpandPosition({
      currentPosition: current.position,
      currentSize: current.size,
      targetSize,
      monitor: monitorInfo,
      anchor,
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
      { durationMs: QUICK_MENU_EXPAND_DURATION_MS },
    );
  });
}

export async function collapseQuickMenuToFloating(): Promise<void> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(COMPACT_SIZE, scale);
    const current = await readWindowBounds(win);
    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;

    const position = resolveQuickMenuCollapsePosition({
      currentPosition: current.position,
      targetSize,
      monitor: monitorInfo,
      anchor,
    });

    await applyWindowBoundsWithFallback(
      win,
      { position, size: targetSize },
      { durationMs: QUICK_MENU_COLLAPSE_DURATION_MS },
    );

    saveSavedPosition(position);
  });
}
