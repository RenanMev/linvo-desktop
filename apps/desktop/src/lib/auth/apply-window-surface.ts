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

  await win.setDecorations(config.decorations);
  await win.setAlwaysOnTop(config.alwaysOnTop);
  await win.setSkipTaskbar(config.skipTaskbar);
  await win.setResizable(config.resizable);
  await win.setSize(new PhysicalSize(size.width, size.height));

  const monitor = await readMonitor();
  if (monitor) {
    const position = computeCenteredPosition(monitor, size);
    await win.setPosition(new PhysicalPosition(position.x, position.y));
  } else {
    await win.center();
  }

  await win.show();
  await win.setFocus();
}
