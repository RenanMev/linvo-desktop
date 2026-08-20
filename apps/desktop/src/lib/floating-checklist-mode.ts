import {
  applyWindowBoundsImmediate,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import {
  ISLAND_EXPANDED_RADIUS_PX,
  resolveCollapseMorphGeometry,
  resolveExpandMorphGeometry,
  withCenteredVisualRects,
  type IslandCollapseHooks,
  type IslandExpandHooks,
  type IslandMorphGeometry,
  type PreparedIslandWindowTransition,
} from "@/lib/floating-island-transition";
import type { EdgeAnchor } from "@/lib/window-anchor";
import {
  CHECKLIST_SIZE,
  COMPACT_SIZE,
  windowSizeForVisual,
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
import { loadSavedAnchor } from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
  resolveCollapsePosition,
  resolveExpandPlan,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";
import {
  applyIslandMorphRegion,
  applyIslandWindowRegion,
} from "@/lib/window-region";

export const CHECKLIST_EXPAND_DURATION_MS = 320;
export const CHECKLIST_COLLAPSE_DURATION_MS = 260;
export type PreparedChecklistCollapse = PreparedIslandWindowTransition;

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

export async function expandFloatingToChecklist(
  options: IslandExpandHooks = {},
): Promise<IslandMorphGeometry> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();

    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(
      windowSizeForVisual(CHECKLIST_SIZE),
      scale,
    );
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
      await applyWindowBoundsImmediate(win, {
        position: plan.moveFirst,
        size: current.size,
      });
    }

    const sameSize =
      current.size.width === targetSize.width &&
      current.size.height === targetSize.height;
    const samePos =
      plan.finalPosition.x === (plan.moveFirst ?? current.position).x &&
      plan.finalPosition.y === (plan.moveFirst ?? current.position).y;

    const sourceBounds = {
      position: plan.moveFirst ?? current.position,
      size: current.size,
    };
    const targetBounds = {
      position: plan.finalPosition,
      size: targetSize,
    };
    const geometry = withCenteredVisualRects(
      resolveExpandMorphGeometry({
        sourceBounds,
        targetBounds,
        scaleFactor: scale,
      }),
      COMPACT_SIZE.width,
      CHECKLIST_SIZE.width,
    );

    // Região do morph: sem recorte lateral para o checklist crescer, mas ainda
    // arredondada — sem região o Windows desenha a moldura do retângulo.
    await applyIslandMorphRegion({
      maxHeight: CHECKLIST_SIZE.height,
      scaleFactor: scale,
      radius: ISLAND_EXPANDED_RADIUS_PX,
    });

    await options.onPrepare?.(geometry);

    if (sameSize && samePos) {
      await options.onResizeStart?.(geometry);
      return geometry;
    }

    rememberRestoreOrigin("checklist", {
      compactPosition: sourceBounds.position,
      expandedPosition: plan.finalPosition,
      expandedSize: targetSize,
    });

    await applyWindowBoundsImmediate(win, targetBounds);
    await options.onViewportReady?.(geometry);
    await options.onResizeStart?.(geometry);
    return geometry;
  });
}

export async function prepareChecklistCollapse(): Promise<PreparedChecklistCollapse> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(
      windowSizeForVisual(COMPACT_SIZE),
      scale,
    );
    const current = await readWindowBounds(win);
    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;

    // Volta no pixel exato de onde saiu; só recalcula se o painel foi mexido.
    const restored = resolveRestorePosition({
      origin: loadRestoreOrigin("checklist"),
      currentPosition: current.position,
      currentSize: current.size,
    });
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

    const targetBounds = { position, size: targetSize };
    return {
      targetBounds,
      scaleFactor: scale,
      geometry: withCenteredVisualRects(
        resolveCollapseMorphGeometry({
          sourceBounds: current,
          targetBounds,
          scaleFactor: scale,
        }),
        CHECKLIST_SIZE.width,
        COMPACT_SIZE.width,
      ),
    };
  });
}

export async function commitChecklistCollapse(
  transition: PreparedChecklistCollapse,
): Promise<void> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    /*
     * Recorte antes do resize, e com a escala já lida no prepare.
     *
     * Aqui a animação de CSS já terminou — a pílula está desenhada no tamanho
     * final — então recortar na pílula não corta nada visível. Fazer isto
     * depois deixava a janela encolhida e sem recorte pelo tempo do IPC
     * (~160ms medidos), e é nesse retângulo cru que o Windows desenha a moldura.
     */
    await applyIslandWindowRegion({
      visual: COMPACT_SIZE,
      scaleFactor: transition.scaleFactor,
      radius: COMPACT_SIZE.height / 2,
    });
    await applyWindowBoundsImmediate(win, transition.targetBounds);
    clearRestoreOrigin("checklist");
  });
}

/** Backwards-compatible immediate collapse for non-visual callers. */
export async function collapseChecklistToFloating(
  options: IslandCollapseHooks = {},
): Promise<void> {
  const transition = await prepareChecklistCollapse();
  await options.onBeforeCommit?.(transition.geometry);
  await commitChecklistCollapse(transition);
  await options.onAfterCommit?.(transition.geometry);
}
