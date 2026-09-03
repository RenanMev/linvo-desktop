import {
  resolveEnvelopeMorphGeometry,
  type IslandMorphGeometry,
} from "@/lib/floating-island-transition";
import type { IslandGrowthDirection } from "@/lib/window-mode";
import { applyIslandMorphRegion } from "@/lib/window-region";
import { enqueueWindowAnimation, getCurrentWindow } from "@/lib/window-transition";

/**
 * Expande a pílula para o quick menu.
 *
 * Desde o envelope fixo (ver `docs/SDD-ILHA-ENVELOPE.md`) a janela `main` não
 * muda de tamanho nem de posição para abrir o quick menu — só a região de
 * recorte muda (união das duas formas, sem bloquear o morph) e o CSS anima o
 * desenho por dentro. Sem `SetWindowPos` no caminho crítico, o morph pode
 * durar o que a curva pedir sem expor o desktop em nenhum frame.
 *
 * A geometria já foi resolvida por quem chama (é pura e sempre igual, ver
 * `resolveEnvelopeMorphGeometry`) — quem chama já preparou e assentou o CSS
 * antes desta função sequer ser invocada; ela só cuida do que exige IPC.
 */
export async function expandFloatingToQuickMenu(
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
      toMode: "quick-menu",
      growth,
    });

    await applyIslandMorphRegion({
      fromMode: "compact",
      toMode: "quick-menu",
      growth,
      scaleFactor: scale,
    });

    return geometry;
  });
}

/** Inversa de `expandFloatingToQuickMenu`: mesma união de região, mesma ausência de resize. */
export async function collapseQuickMenuToFloating(
  growth: IslandGrowthDirection,
): Promise<IslandMorphGeometry> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const geometry = resolveEnvelopeMorphGeometry({
      fromMode: "quick-menu",
      toMode: "compact",
      growth,
    });

    await applyIslandMorphRegion({
      fromMode: "quick-menu",
      toMode: "compact",
      growth,
      scaleFactor: scale,
    });

    return geometry;
  });
}
