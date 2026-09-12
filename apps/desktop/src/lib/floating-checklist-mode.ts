import {
  resolveEnvelopeMorphGeometry,
  type IslandMorphGeometry,
} from "@/lib/floating-island-transition";
import type { IslandGrowthDirection } from "@/lib/window-mode";
import { applyIslandMorphRegion } from "@/lib/window-region";
import { enqueueWindowAnimation, getCurrentWindow } from "@/lib/window-transition";

/**
 * Expande a pílula para o checklist de procedimento.
 *
 * Mesma lógica de `expandFloatingToQuickMenu`: o envelope fixo (ver
 * `docs/SDD-ILHA-ENVELOPE.md`) não muda de tamanho nem de posição — só a
 * região de recorte. A geometria é pura e já foi resolvida por quem chama.
 */
export async function expandFloatingToChecklist(
  growth: IslandGrowthDirection,
): Promise<IslandMorphGeometry> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();

    const scale = await win.scaleFactor();
    const geometry = resolveEnvelopeMorphGeometry({
      fromMode: "compact",
      toMode: "checklist",
      growth,
    });

    await applyIslandMorphRegion({
      fromMode: "compact",
      toMode: "checklist",
      growth,
      scaleFactor: scale,
    });

    return geometry;
  });
}

/** Inversa de `expandFloatingToChecklist`. */
export async function collapseChecklistToFloating(
  growth: IslandGrowthDirection,
): Promise<IslandMorphGeometry> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const geometry = resolveEnvelopeMorphGeometry({
      fromMode: "checklist",
      toMode: "compact",
      growth,
    });

    await applyIslandMorphRegion({
      fromMode: "checklist",
      toMode: "compact",
      growth,
      scaleFactor: scale,
    });

    return geometry;
  });
}
