import { invoke } from "@tauri-apps/api/core";

import { ISLAND_GUTTER_PX } from "@/lib/floating-island-transition";
import { islandLog } from "@/lib/island-debug";
import type { Size } from "@/lib/window-position";
import { ISLAND_WINDOW_WIDTH } from "@/lib/window-mode";

/**
 * Recorta a janela ao desenho visível.
 *
 * A janela flutuante tem sempre a largura do painel, mesmo compacta, para que
 * abrir mude só a altura (ver `ISLAND_WINDOW_WIDTH`). As faixas transparentes
 * que sobram nas laterais continuariam captando cliques destinados ao desktop —
 * `SetWindowRgn` tira essas faixas da janela de verdade, no nível da HWND.
 *
 * Nunca lança: perder o recorte piora a área clicável, mas não justifica abortar
 * a transição de janela que chamou.
 */
export async function applyIslandWindowRegion(input: {
  /** Tamanho do desenho, em px lógicos. */
  visual: Size;
  scaleFactor: number;
  /** Metade da altura para a pílula; o raio do painel para os demais. */
  radius: number;
}): Promise<void> {
  const { visual, scaleFactor, radius } = input;

  /*
   * A região tem que ficar DENTRO do que o CSS pinta, nunca fora.
   *
   * As superfícies são desenhadas com `--island-gutter` de recuo (ver
   * `.floating-island-surface-stable`), então montar a região a partir do
   * retângulo visual cru deixava uma faixa de 1-3px que a janela inclui e o CSS
   * nunca pinta — e nela aparece o fundo branco padrão do WebView2, como uma
   * linha clara em volta da pílula.
   *
   * Arredondar para dentro (ceil no início, floor no fim) mantém isso válido em
   * escalas fracionárias, onde o recuo lógico não cai em pixel inteiro.
   */
  const inset = ISLAND_GUTTER_PX;
  const left = (ISLAND_WINDOW_WIDTH - visual.width) / 2 + inset;
  const x = Math.ceil(left * scaleFactor);
  const y = Math.ceil(inset * scaleFactor);
  const region = {
    x,
    y,
    width: Math.floor((visual.width - inset * 2) * scaleFactor),
    height: Math.floor((visual.height - inset * 2) * scaleFactor),
  };

  // O raio também é do retângulo já recuado: usar o raio do desenho cru deixaria
  // os cantos da região mais abertos que os do CSS, expondo a mesma faixa branca
  // justamente nas curvas.
  const radiusPx = Math.floor(
    Math.min(radius, (visual.height - inset * 2) / 2) * scaleFactor,
  );

  try {
    await invoke("set_window_region", {
      region,
      radius: Math.max(0, radiusPx),
    });
    islandLog("region:apply", { region, visual, scaleFactor });
  } catch (error) {
    islandLog("region:apply:FAILED", { region, error: String(error) });
  }
}

/**
 * Região usada enquanto o morph roda: largura cheia e a altura do maior dos dois
 * estados, para nada ser recortado no meio da animação.
 *
 * Importante que continue sendo uma região arredondada, e não `null`: sem região
 * a janela volta a ser um retângulo cru e o Windows desenha a moldura em volta
 * dele — a barra clara que aparecia ao abrir e fechar o chat. A região excedente
 * é limitada ao retângulo da janela pelo próprio sistema, então passar a altura
 * expandida é seguro nos dois sentidos.
 */
export async function applyIslandMorphRegion(input: {
  maxHeight: number;
  scaleFactor: number;
  radius: number;
}): Promise<void> {
  const { maxHeight, scaleFactor, radius } = input;
  await applyIslandWindowRegion({
    visual: { width: ISLAND_WINDOW_WIDTH, height: maxHeight },
    scaleFactor,
    radius,
  });
}
