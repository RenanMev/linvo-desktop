import {
  applyWindowBoundsImmediate,
  logicalToPhysical,
  readWindowBounds,
  releaseMinWindowSize,
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
  COMPACT_SIZE,
  QUICK_MENU_SIZE,
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
import {
  applyIslandMorphRegion,
  applyIslandWindowRegion,
} from "@/lib/window-region";

/**
 * A janela não é animada: vai ao tamanho final num único `SetWindowPos` e a
 * transição visual fica toda no CSS (`.quick-center-panel-ready`).
 *
 * Animar o tamanho da janela frame a frame trepida por construção — o WebView2
 * refaz o layout do DOM inteiro a cada `SetWindowPos`, e no Tauri isso é mais
 * caro que no Wry (tauri-apps/tauri#6322). Duas tentativas anteriores tentaram
 * contornar isso (expansão em duas fases, depois fase única mais curta) e as
 * duas trepidaram; o caminho liso é não animar a janela.
 */
export type ExpandQuickMenuOptions = IslandExpandHooks;
export type PreparedQuickMenuCollapse = PreparedIslandWindowTransition;

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
  currentSize?: Size;
  targetSize: Size;
  monitor: MonitorInfo | null;
  anchor?: EdgeAnchor;
}): Position {
  return resolveCollapsePosition(input);
}

export async function expandFloatingToQuickMenu(
  options: ExpandQuickMenuOptions = {},
): Promise<IslandMorphGeometry> {
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
      QUICK_MENU_SIZE.width,
    );

    // Região do morph: larga o bastante para o painel crescer sem recorte, mas
    // ainda arredondada — sem região o Windows desenha a moldura do retângulo.
    await applyIslandMorphRegion({
      maxHeight: QUICK_MENU_SIZE.height,
      scaleFactor: scale,
      radius: ISLAND_EXPANDED_RADIUS_PX,
    });

    await options.onPrepare?.(geometry);

    if (sameSize && samePos) {
      await options.onResizeStart?.(geometry);
      return geometry;
    }

    rememberRestoreOrigin("quick-menu", {
      compactPosition: sourceBounds.position,
      expandedPosition: plan.finalPosition,
      expandedSize: targetSize,
    });

    // Janela vai ao tamanho final num único SetWindowPos; o painel entra por
    // transform no CSS (ver `.quick-center-panel-ready`). Animar os dois ao
    // mesmo tempo é o que trepidava.
    await applyWindowBoundsImmediate(win, targetBounds);

    // Só depois de a janela estar no tamanho final, para o painel nunca pintar
    // recortado dentro da pílula.
    await options.onViewportReady?.(geometry);
    await options.onResizeStart?.(geometry);
    return geometry;
  });
}

export async function prepareQuickMenuCollapse(): Promise<PreparedQuickMenuCollapse> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(windowSizeForVisual(COMPACT_SIZE), scale);
    const current = await readWindowBounds(win);
    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;

    // Volta no pixel exato de onde saiu; só recalcula se o painel foi mexido.
    const restored = resolveRestorePosition({
      origin: loadRestoreOrigin("quick-menu"),
      currentPosition: current.position,
      currentSize: current.size,
    });
    const position = restored
      ? monitorInfo
        ? clampToMonitor(restored, targetSize, monitorInfo)
        : restored
      : resolveQuickMenuCollapsePosition({
          currentPosition: current.position,
          currentSize: current.size,
          targetSize,
          monitor: monitorInfo,
          anchor,
        });

    /*
     * Solta o mínimo e o resize AQUI, antes da animação, não no commit.
     *
     * As duas chamadas são invisíveis (não mudam um pixel), mas custam ~150ms
     * de IPC somadas. No commit elas ficavam entre o fim da animação e o
     * `SetWindowPos`, e nesse intervalo a janela seguia expandida e
     * transparente com só a pílula pintada — o desktop aparecia em volta dela.
     * Medido em ~240ms de buraco; ver `island-debug`.
     */
    await releaseMinWindowSize(win);
    await win.setResizable(false);

    // O CSS recebe esta geometria antes do único commit nativo de bounds.
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
        QUICK_MENU_SIZE.width,
        COMPACT_SIZE.width,
      ),
    };
  });
}

export async function commitQuickMenuCollapse(
  transition: PreparedQuickMenuCollapse,
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
     *
     * O mínimo e o resizable já foram soltos no prepare, então não sobra
     * nenhum IPC entre o fim da animação e o SetWindowPos.
     */
    await applyIslandWindowRegion({
      visual: COMPACT_SIZE,
      scaleFactor: transition.scaleFactor,
      radius: COMPACT_SIZE.height / 2,
    });
    await applyWindowBoundsImmediate(win, transition.targetBounds);
    clearRestoreOrigin("quick-menu");
    saveSavedPosition(transition.targetBounds.position);
  });
}

/** Backwards-compatible immediate collapse for non-visual callers. */
export async function collapseQuickMenuToFloating(
  options: IslandCollapseHooks = {},
): Promise<void> {
  const transition = await prepareQuickMenuCollapse();
  await options.onBeforeCommit?.(transition.geometry);
  if (options.shouldCommit?.() === false) {
    return;
  }
  await commitQuickMenuCollapse(transition);
}
