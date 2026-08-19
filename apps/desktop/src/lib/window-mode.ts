import type { Size } from "@/lib/window-position";

/**
 * Largura única de toda janela flutuante, em qualquer modo.
 *
 * A janela nunca muda de largura nem de posição horizontal: abrir o chat ou o
 * checklist mexe só na altura. Isso existe porque mover e redimensionar no mesmo
 * `SetWindowPos` obrigava o CSS a compensar o deslocamento, e essa compensação
 * dependia de o WebView refazer o layout no mesmo frame — quando não refazia, a
 * pílula saltava ~131px para o lado. Sem movimento não há o que compensar.
 *
 * As formas mais estreitas (pílula, checklist) são centralizadas por dentro; o
 * excedente é recortado da janela por `set_window_region`, para as faixas
 * transparentes não captarem cliques do desktop.
 */
export const ISLAND_WINDOW_WIDTH = 380;

/** Pílula flutuante fina (Neural Premium Graphite): o desenho, não a janela. */
export const COMPACT_SIZE: Size = { width: 168, height: 34 };
export const CHECKLIST_SIZE: Size = { width: 288, height: 420 };
export const QUICK_MENU_SIZE: Size = { width: ISLAND_WINDOW_WIDTH, height: 520 };

/** Tamanho da janela de cada modo: largura fixa, altura do próprio desenho. */
export function windowSizeForVisual(visual: Size): Size {
  return { width: ISLAND_WINDOW_WIDTH, height: visual.height };
}

/** Retângulo do desenho dentro da janela, centralizado na horizontal. */
export function centeredVisualRect(
  visual: Size,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round((ISLAND_WINDOW_WIDTH - visual.width) / 2),
    y: 0,
    width: visual.width,
    height: visual.height,
  };
}
export const PANEL_SIZE: Size = { width: 1200, height: 800 };

/** Janela do onboarding: uma etapa por tela, coluna única. Não redimensionável. */
export const ONBOARDING_SIZE: Size = { width: 620, height: 680 };
export const ONBOARDING_MIN_SIZE: Size = { width: 520, height: 560 };

/** Espessura do handle no eixo perpendicular à borda (≤16px por spec FBP-08). */
export const EDGE_HANDLE_THICKNESS = 12;
/**
 * Comprimento do handle ao longo da borda.
 *
 * Esta é a dimensão que de fato limita a mira. No eixo perpendicular o cursor
 * para na borda da tela, o que torna o alvo efetivamente infinito nesse sentido
 * (Fitts) — por isso 12px de espessura funciona apesar de ficar abaixo dos 24px
 * do WCAG 2.5.8. Ao longo da borda não existe essa ajuda: é preciso encontrar a
 * tira. 64px era pouco; 112px reduz bem a procura sem virar uma barra.
 */
export const EDGE_HANDLE_LENGTH = 112;
