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
import { updateTaskbarVisibility } from "@/lib/app-windows";
import { applyIslandRegionForMode } from "@/lib/window-region";
import { EDGE_MARGIN, loadIslandPillPosition } from "@/lib/window-storage";
import { readWorkArea } from "@/lib/window-work-area";

async function resolveCompactPillPosition(
  targetSize: { width: number; height: number },
  scale: number,
): Promise<Position> {
  const monitor = await currentMonitor();
  const saved = loadIslandPillPosition(scale);

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
  await win.setAlwaysOnTop(config.alwaysOnTop);
  await win.setSkipTaskbar(config.skipTaskbar);
  await win.setResizable(config.resizable);
  await win.setMaximizable(config.maximizable);

  await win.setSize(
    new PhysicalSize(envelopeTargetSize.width, envelopeTargetSize.height),
  );
  await win.setPosition(
    new PhysicalPosition(envelopePosition.x, envelopePosition.y),
  );

  // A janela nasce do tamanho do envelope; sem o recorte as faixas
  // transparentes em volta da pílula captariam cliques do desktop.
  await applyIslandRegionForMode({ mode: "compact", growth, scaleFactor: scale });

  await updateTaskbarVisibility(true);
  await win.show();
  await win.setFocus();

  return growth;
}
