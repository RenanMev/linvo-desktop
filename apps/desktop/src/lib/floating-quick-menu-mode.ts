import {
  applyWindowBoundsImmediate,
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import type { EdgeAnchor } from "@/lib/window-anchor";
import { COMPACT_SIZE, QUICK_MENU_SIZE } from "@/lib/window-mode";
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
export type ExpandQuickMenuOptions = {
  /** Chamado quando a janela já está no tamanho final, para o painel entrar. */
  onResizeStart?: () => void;
};

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
): Promise<void> {
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
      options.onResizeStart?.();
      return;
    }

    rememberRestoreOrigin("quick-menu", {
      compactPosition: plan.moveFirst ?? current.position,
      expandedPosition: plan.finalPosition,
      expandedSize: targetSize,
    });

    // Janela vai ao tamanho final num único SetWindowPos; o painel entra por
    // transform no CSS (ver `.quick-center-panel-ready`). Animar os dois ao
    // mesmo tempo é o que trepidava.
    await applyWindowBoundsImmediate(win, {
      position: plan.finalPosition,
      size: targetSize,
    });

    // Só depois de a janela estar no tamanho final, para o painel nunca pintar
    // recortado dentro da pílula.
    options.onResizeStart?.();
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

    // Volta no pixel exato de onde saiu; só recalcula se o painel foi mexido.
    const restored = resolveRestorePosition({
      origin: loadRestoreOrigin("quick-menu"),
      currentPosition: current.position,
      currentSize: current.size,
    });
    clearRestoreOrigin("quick-menu");

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

    // O conteúdo já saiu por CSS antes daqui (QUICK_MENU_EXIT_DURATION_MS em
    // BarApp), então o encolhimento em si é invisível — não precisa animar.
    await applyWindowBoundsImmediate(win, { position, size: targetSize });

    saveSavedPosition(position);
  });
}
