import type { Size } from "@/lib/window-position";

/** Pílula flutuante fina (Neural Premium Graphite). */
export const COMPACT_SIZE: Size = { width: 168, height: 34 };
export const CHECKLIST_SIZE: Size = { width: 288, height: 420 };
export const QUICK_MENU_SIZE: Size = { width: 380, height: 520 };
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
