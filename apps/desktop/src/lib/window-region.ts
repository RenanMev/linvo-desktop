import { invoke } from "@tauri-apps/api/core";

import {
  ISLAND_GUTTER_PX,
  ISLAND_MORPH_REGION_SLACK_PX,
} from "@/lib/floating-island-transition";
import {
  inflateRectWithinEnvelope,
  ISLAND_EXPANDED_RADIUS_PX,
  islandRectForMode,
  radiusForEnvelopeMode,
  unionRect,
  type IslandEnvelopeMode,
  type IslandEnvelopeRect,
  type IslandGrowthDirection,
} from "@/lib/window-mode";

/**
 * Recorta a janela num retângulo explícito, em coordenadas locais da própria
 * janela (0,0 = canto superior esquerdo do que a janela realmente é agora).
 *
 * A região tem que ficar DENTRO do que o CSS pinta, nunca fora.
 *
 * As superfícies são desenhadas com `--island-gutter` de recuo, então montar a
 * região a partir do retângulo cru deixaria uma faixa de 1-3px que a janela
 * inclui e o CSS nunca pinta — e nela aparece o fundo branco padrão do
 * WebView2, como uma linha clara em volta da forma. Arredondar para dentro
 * (ceil no início, floor no fim) mantém isso válido em escalas fracionárias,
 * onde o recuo lógico não cai em pixel inteiro.
 *
 * Nunca lança: perder o recorte piora a área clicável, mas não justifica
 * abortar a transição de janela que chamou.
 */
export async function applyIslandEnvelopeRegion(input: {
  rect: IslandEnvelopeRect;
  scaleFactor: number;
  radius: number;
}): Promise<void> {
  const { rect, scaleFactor, radius } = input;
  const inset = ISLAND_GUTTER_PX;

  const x = Math.ceil((rect.x + inset) * scaleFactor);
  const y = Math.ceil((rect.y + inset) * scaleFactor);
  const region = {
    x,
    y,
    width: Math.floor((rect.width - inset * 2) * scaleFactor),
    height: Math.floor((rect.height - inset * 2) * scaleFactor),
  };

  // O raio também é do retângulo já recuado, e nunca maior que a metade do
  // lado mais curto — os cantos da região não podem abrir mais que os do CSS.
  const radiusPx = Math.floor(
    Math.min(radius, (Math.min(rect.width, rect.height) - inset * 2) / 2) *
      scaleFactor,
  );

  try {
    await invoke("set_window_region", {
      region,
      radius: Math.max(0, radiusPx),
    });
  } catch {
    // Segue sem recorte.
  }
}

/**
 * Região de repouso para `mode`: o retângulo exato do desenho dentro do
 * envelope (ver `docs/SDD-ILHA-ENVELOPE.md`), com o raio do próprio modo.
 */
export async function applyIslandRegionForMode(input: {
  mode: IslandEnvelopeMode;
  growth: IslandGrowthDirection;
  scaleFactor: number;
}): Promise<void> {
  await applyIslandEnvelopeRegion({
    rect: islandRectForMode(input.mode, input.growth),
    scaleFactor: input.scaleFactor,
    radius: radiusForEnvelopeMode(input.mode),
  });
}

/**
 * Região usada enquanto o morph roda: a união dos retângulos de origem e
 * destino, inflada por `ISLAND_MORPH_REGION_SLACK_PX` e arredondada.
 *
 * Sem região o Windows desenha a moldura do retângulo; sem a união uma das
 * duas formas ficaria cortada em trânsito; e sem a folga a curva de abertura
 * — que passa do retângulo de destino antes de voltar — teria o pico cortado
 * numa linha reta bem no quadro mais expressivo da animação.
 */
export async function applyIslandMorphRegion(input: {
  fromMode: IslandEnvelopeMode;
  toMode: IslandEnvelopeMode;
  growth: IslandGrowthDirection;
  scaleFactor: number;
}): Promise<void> {
  const from = islandRectForMode(input.fromMode, input.growth);
  const to = islandRectForMode(input.toMode, input.growth);
  await applyIslandEnvelopeRegion({
    rect: inflateRectWithinEnvelope(
      unionRect(from, to),
      ISLAND_MORPH_REGION_SLACK_PX,
    ),
    scaleFactor: input.scaleFactor,
    radius: ISLAND_EXPANDED_RADIUS_PX,
  });
}
