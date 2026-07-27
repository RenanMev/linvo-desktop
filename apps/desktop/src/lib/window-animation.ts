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
  return {
    width: Math.round(size.width * scaleFactor),
    height: Math.round(size.height * scaleFactor),
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

export async function applyWindowBoundsWithFallback(
  win: Window,
  to: WindowBounds,
  options?: AnimateWindowBoundsOptions,
): Promise<void> {
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
