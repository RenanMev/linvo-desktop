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
import {
  COMPACT_SIZE,
  envelopePositionForPill,
  ISLAND_ENVELOPE_SIZE,
  resolveIslandGrowthDirection,
  type IslandGrowthDirection,
} from "@/lib/window-mode";
import {
  clampToMonitor,
  computeTopCenter,
  type Position,
} from "@/lib/window-position";
import { applyIslandRegionForMode } from "@/lib/window-region";
import {
  EDGE_MARGIN,
  hydrateWindowStorage,
  ISLAND_PILL_POSITION_STORAGE_KEY,
  loadIslandPillPosition,
  loadSavedPlacement,
  resolvePlacementMonitor,
} from "@/lib/window-storage";
import { readWorkArea } from "@/lib/window-work-area";

async function resolveCompactPillPosition(
  targetSize: { width: number; height: number },
  scale: number,
): Promise<Position> {
  const saved = loadIslandPillPosition(scale);
  const monitor = await resolvePlacementMonitor(
    loadSavedPlacement(ISLAND_PILL_POSITION_STORAGE_KEY) ??
      loadSavedPlacement(),
  );

  if (saved && monitor) {
    return clampToMonitor(saved, targetSize, monitor);
  }

  if (monitor) {
    return computeTopCenter(monitor, targetSize, EDGE_MARGIN);
  }

  return (await readWindowBounds(getCurrentWindow())).position;
}

/**
 * Sai do tamanho de Auth (`AUTH_SIZE`, aplicado no boot da janela `main`) e
 * entra no envelope fixo da ilha (ver `docs/SDD-ILHA-ENVELOPE.md`).
 *
 * A direção de crescimento é resolvida aqui, uma vez, em repouso — nunca
 * durante um morph — e devolvida para quem chama guardar: todo o resto da
 * sessão (expandir/colapsar quick menu e checklist, encolher para a borda)
 * depende de saber se o envelope cresce para baixo ou para cima a partir da
 * pílula.
 */
export async function enterFloatingMode(): Promise<IslandGrowthDirection> {
  await hydrateWindowStorage();
  await hydrateDesktopSettings();

  const config = configForSurfaceMode("compact");
  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const pillTargetSize = logicalToPhysical(COMPACT_SIZE, scale);
  const pillPosition = await resolveCompactPillPosition(pillTargetSize, scale);

  const workArea = await readWorkArea();
  const growth = resolveIslandGrowthDirection({
    pillPosition,
    workArea,
    scaleFactor: scale,
  });

  const envelopeTargetSize = logicalToPhysical(ISLAND_ENVELOPE_SIZE, scale);
  const envelopePosition = envelopePositionForPill({
    pillPosition,
    growth,
    scaleFactor: scale,
  });

  await applyWindowBoundsWithFallback(win, {
    position: envelopePosition,
    size: envelopeTargetSize,
  });

  await win.setDecorations(config.decorations);
  await win.setSkipTaskbar(config.skipTaskbar);
  await win.setResizable(config.resizable);
  await win.setMaximizable(config.maximizable);

  await win.setSize(
    new PhysicalSize(envelopeTargetSize.width, envelopeTargetSize.height),
  );
  await win.setPosition(
    new PhysicalPosition(envelopePosition.x, envelopePosition.y),
  );

  await applyIslandRegionForMode({ mode: "compact", growth, scaleFactor: scale });

  await setTopmostGuard(true);
  await setExcludeFromCapture(loadHideFromCapture());
  await overlayChromeStatus();
  await updateTaskbarVisibility(true);
  await showWindowNoActivate();

  return growth;
}
