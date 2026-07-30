import {
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import type { EdgeAnchor } from "@/lib/window-anchor";
import { CHECKLIST_SIZE, COMPACT_SIZE } from "@/lib/window-mode";
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
import { loadSavedAnchor } from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
  resolveCollapsePosition,
  resolveExpandPlan,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";

export const CHECKLIST_EXPAND_DURATION_MS = 320;
export const CHECKLIST_COLLAPSE_DURATION_MS = 260;

export function resolveChecklistExpandPosition(input: {
  currentPosition: Position;
  currentSize: Size;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): { moveFirst: Position | null; finalPosition: Position } {
  return resolveExpandPlan(input);
}

export function resolveChecklistCollapsePosition(input: {
  currentPosition: Position;
  currentSize?: Size;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): Position {
  return resolveCollapsePosition(input);
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
    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;

    const plan = resolveChecklistExpandPosition({
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

    rememberRestoreOrigin("checklist", {
      compactPosition: plan.moveFirst ?? current.position,
      expandedPosition: plan.finalPosition,
      expandedSize: targetSize,
    });

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
    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;

    // Volta no pixel exato de onde saiu; só recalcula se o painel foi mexido.
    const restored = resolveRestorePosition({
      origin: loadRestoreOrigin("checklist"),
      currentPosition: current.position,
      currentSize: current.size,
    });
    clearRestoreOrigin("checklist");

    const position = restored
      ? monitorInfo
        ? clampToMonitor(restored, targetSize, monitorInfo)
        : restored
      : resolveChecklistCollapsePosition({
          currentPosition: current.position,
          currentSize: current.size,
          targetSize,
          monitor: monitorInfo,
          anchor,
        });

    await applyWindowBoundsWithFallback(
      win,
      { position, size: targetSize },
      { durationMs: CHECKLIST_COLLAPSE_DURATION_MS },
    );
  });
}
