import {
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";

import { configForSurfaceMode } from "@/lib/auth/window-auth";
import { updateTaskbarVisibility } from "@/lib/app-windows";
import {
  hydrateDesktopSettings,
  loadHideFromCapture,
} from "@/lib/desktop-settings-store";
import {
  overlayChromeStatus,
  setExcludeFromCapture,
  setTopmostGuard,
  showWindowNoActivate,
} from "@/lib/overlay-chrome";
import {
  applyWindowBoundsWithFallback,
  logicalToPhysical,
  readWindowBounds,
} from "@/lib/window-animation";
import { COMPACT_SIZE, windowSizeForVisual } from "@/lib/window-mode";
import {
  clampToMonitor,
  computeTopCenter,
  type Position,
} from "@/lib/window-position";
import { applyIslandWindowRegion } from "@/lib/window-region";
import {
  EDGE_MARGIN,
  hydrateWindowStorage,
  loadSavedPlacement,
  loadSavedPosition,
  resolvePlacementMonitor,
} from "@/lib/window-storage";

async function resolveCompactPosition(
  targetSize: { width: number; height: number },
): Promise<Position> {
  const saved = loadSavedPosition();
  const monitor = await resolvePlacementMonitor(loadSavedPlacement());

  if (saved && monitor) {
    return clampToMonitor(saved, targetSize, monitor);
  }

  if (monitor) {
    return computeTopCenter(monitor, targetSize, EDGE_MARGIN);
  }

  return (await readWindowBounds(getCurrentWindow())).position;
}

export async function enterFloatingMode(): Promise<void> {
  await hydrateWindowStorage();
  await hydrateDesktopSettings();

  const config = configForSurfaceMode("compact");
  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const targetSize = logicalToPhysical(windowSizeForVisual(COMPACT_SIZE), scale);
  const targetPosition = await resolveCompactPosition(targetSize);

  await applyWindowBoundsWithFallback(win, {
    position: targetPosition,
    size: targetSize,
  });

  await win.setDecorations(config.decorations);
  await win.setSkipTaskbar(config.skipTaskbar);
  await win.setResizable(config.resizable);
  await win.setMaximizable(config.maximizable);

  await win.setSize(new PhysicalSize(targetSize.width, targetSize.height));
  await win.setPosition(
    new PhysicalPosition(targetPosition.x, targetPosition.y),
  );

  await applyIslandWindowRegion({
    visual: COMPACT_SIZE,
    scaleFactor: scale,
    radius: COMPACT_SIZE.height / 2,
  });

  await setTopmostGuard(true);
  await setExcludeFromCapture(loadHideFromCapture());
  await overlayChromeStatus();
  await updateTaskbarVisibility(true);
  await showWindowNoActivate();
}
