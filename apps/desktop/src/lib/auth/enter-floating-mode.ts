import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";

import { configForSurfaceMode } from "@/lib/auth/window-auth";
import {
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import { COMPACT_SIZE } from "@/lib/window-mode";
import {
  clampToMonitor,
  computeTopCenter,
  type Position,
} from "@/lib/window-position";
import { updateTaskbarVisibility } from "@/lib/app-windows";
import { EDGE_MARGIN, loadSavedPosition } from "@/lib/window-storage";

async function resolveCompactPosition(
  targetSize: { width: number; height: number },
): Promise<Position> {
  const monitor = await currentMonitor();
  const saved = loadSavedPosition();

  if (saved && monitor) {
    return clampToMonitor(saved, targetSize, {
      position: { x: monitor.position.x, y: monitor.position.y },
      size: { width: monitor.size.width, height: monitor.size.height },
    });
  }

  if (monitor) {
    return computeTopCenter(
      {
        position: { x: monitor.position.x, y: monitor.position.y },
        size: { width: monitor.size.width, height: monitor.size.height },
      },
      targetSize,
      EDGE_MARGIN,
    );
  }

  return (await readWindowBounds(getCurrentWindow())).position;
}

export async function enterFloatingMode(): Promise<void> {
  const config = configForSurfaceMode("compact");
  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const targetSize = logicalToPhysical(COMPACT_SIZE, scale);
  const targetPosition = await resolveCompactPosition(targetSize);

  await applyWindowBoundsWithFallback(win, {
    position: targetPosition,
    size: targetSize,
  });

  await win.setDecorations(config.decorations);
  await win.setAlwaysOnTop(config.alwaysOnTop);
  await win.setSkipTaskbar(config.skipTaskbar);
  await win.setResizable(config.resizable);
  await win.setMaximizable(config.maximizable);

  await win.setSize(new PhysicalSize(targetSize.width, targetSize.height));
  await win.setPosition(
    new PhysicalPosition(targetPosition.x, targetPosition.y),
  );

  await updateTaskbarVisibility(true);
  await win.show();
  await win.setFocus();
}
