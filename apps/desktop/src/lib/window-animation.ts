import { invoke } from "@tauri-apps/api/core";
import {
  PhysicalPosition,
  PhysicalSize,
  type Window,
} from "@tauri-apps/api/window";

import type { MonitorInfo, Position, Size } from "@/lib/window-position";

export type WindowBounds = {
  position: Position;
  size: Size;
};

export const DEFAULT_ANIMATION_DURATION_MS = 200;

export function logicalToPhysical(size: Size, scaleFactor: number): Size {
  // Math.ceil, not round: rounding down leaves the physical window a
  // fraction of a logical pixel short, clipping the bottom/right 1px
  // border on non-integer DPI scales (e.g. 125%/150%).
  return {
    width: Math.ceil(size.width * scaleFactor),
    height: Math.ceil(size.height * scaleFactor),
  };
}

export function computeCenteredPosition(
  monitor: MonitorInfo,
  winSize: Size,
): Position {
  return {
    x: monitor.position.x + Math.round((monitor.size.width - winSize.width) / 2),
    y: monitor.position.y + Math.round((monitor.size.height - winSize.height) / 2),
  };
}

export async function readWindowBounds(win: Window): Promise<WindowBounds> {
  const position = await win.outerPosition();
  const size = await win.outerSize();
  return {
    position: { x: position.x, y: position.y },
    size: { width: size.width, height: size.height },
  };
}

export type AnimateWindowBoundsOptions = {
  durationMs?: number;
};

export async function animateWindowBounds(
  to: WindowBounds,
  options?: AnimateWindowBoundsOptions,
): Promise<boolean> {
  return invoke<boolean>("animate_window_bounds", {
    to: {
      x: to.position.x,
      y: to.position.y,
      width: to.size.width,
      height: to.size.height,
    },
    durationMs: options?.durationMs ?? DEFAULT_ANIMATION_DURATION_MS,
  });
}

/**
 * Aplica bounds de uma vez, sem animar.
 *
 * Preferir isto a `applyWindowBoundsWithFallback` quando existe uma animação de
 * CSS acompanhando a transição: o WebView2 refaz o layout a cada `SetWindowPos`,
 * então animar o tamanho da janela e o conteúdo ao mesmo tempo trepida. Um
 * `SetWindowPos` só = um relayout só, e a sensação de movimento vem do CSS.
 */
export async function applyWindowBoundsImmediate(
  win: Window,
  to: WindowBounds,
): Promise<void> {
  try {
    await invoke("set_window_bounds", {
      to: {
        x: to.position.x,
        y: to.position.y,
        width: to.size.width,
        height: to.size.height,
      },
    });
  } catch {
    // Fora do Windows o comando cai no set_size/set_position do Tauri; se nem
    // isso existir (testes/web), aplica pelo próprio handle da janela.
    await win.setSize(new PhysicalSize(to.size.width, to.size.height));
    await win.setPosition(new PhysicalPosition(to.position.x, to.position.y));
  }
}

export async function applyWindowBoundsWithFallback(
  win: Window,
  to: WindowBounds,
  options?: AnimateWindowBoundsOptions,
): Promise<void> {
  if (
    typeof document !== "undefined" &&
    document.documentElement.dataset.reduceMotion === "true"
  ) {
    await win.setSize(new PhysicalSize(to.size.width, to.size.height));
    await win.setPosition(new PhysicalPosition(to.position.x, to.position.y));
    return;
  }

  let needsFallback = true;

  try {
    const completed = await animateWindowBounds(to, options);
    needsFallback = !completed;
  } catch {
    needsFallback = true;
  }

  if (needsFallback) {
    await win.setSize(new PhysicalSize(to.size.width, to.size.height));
    await win.setPosition(new PhysicalPosition(to.position.x, to.position.y));
  }
}
