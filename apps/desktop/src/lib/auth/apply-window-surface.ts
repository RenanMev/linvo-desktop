import { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

import {
  computeCenteredPosition,
  logicalToPhysical,
} from "@/lib/window-animation";
import type { MonitorInfo } from "@/lib/window-position";
import {
  configForSurfaceMode,
  type WindowSurfaceConfig,
  type WindowSurfaceMode,
} from "@/lib/auth/window-auth";
import {
  setClickThrough,
  setTopmostGuard,
  showWindowNoActivate,
} from "@/lib/overlay-chrome";

async function readMonitor(): Promise<MonitorInfo | null> {
  const monitor = await currentMonitor();
  if (!monitor) {
    return null;
  }
  return {
    position: { x: monitor.position.x, y: monitor.position.y },
    size: { width: monitor.size.width, height: monitor.size.height },
  };
}

export async function applyWindowSurface(mode: WindowSurfaceMode): Promise<void> {
  const config = configForSurfaceMode(mode);
  await applyWindowSurfaceConfig(config);
}

export async function applyWindowSurfaceConfig(
  config: WindowSurfaceConfig,
): Promise<void> {
  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const size = logicalToPhysical(config.size, scale);
  const compact = config.mode === "compact";

  /*
   * Desligar o guard **antes** do `setAlwaysOnTop`: `set_topmost_guard(false)`
   * só para de reafirmar o topmost, não o desfaz. Na ordem inversa, um tick do
   * loop (500 ms) caindo entre as duas chamadas deixava a tela de login presa
   * na frente de tudo.
   */
  if (!compact) {
    await setTopmostGuard(false);
    await setClickThrough({ enabled: false, holes: [] });
  }

  await win.setDecorations(config.decorations);
  if (!compact) {
    await win.setAlwaysOnTop(config.alwaysOnTop);
  }
  await win.setSkipTaskbar(config.skipTaskbar);
  await win.setResizable(config.resizable);
  await win.setMaximizable(config.maximizable);
  await win.setSize(new PhysicalSize(size.width, size.height));

  const monitor = await readMonitor();
  if (monitor) {
    const position = computeCenteredPosition(monitor, size);
    await win.setPosition(new PhysicalPosition(position.x, position.y));
  } else {
    await win.center();
  }

  if (compact) {
    await setTopmostGuard(true);
    await showWindowNoActivate();
    return;
  }

  await win.show();
  await win.setFocus();
}
