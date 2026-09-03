import type { MonitorInfo, Position, Size } from "@/lib/window-position";

/**
 * Largura de desenho de todo painel expandido (`quick-menu`/`checklist`).
 *
 * Não é a largura da janela — desde o envelope fixo (ver
 * `docs/SDD-ILHA-ENVELOPE.md`) a janela `main` tem sempre `ISLAND_ENVELOPE_SIZE`,
 * em todos os modos. Isto é só a referência de largura que `islandRectForMode`
 * usa para centralizar cada painel dentro do envelope.
 */
export const ISLAND_PANEL_WIDTH = 380;

/** Pílula flutuante fina (Neural Premium Graphite): o desenho, não a janela. */
export const COMPACT_SIZE: Size = { width: 200, height: 38 };
export const CHECKLIST_SIZE: Size = { width: 288, height: 420 };
export const QUICK_MENU_SIZE: Size = { width: ISLAND_PANEL_WIDTH, height: 520 };

/**
 * Envelope fixo da ilha (ver `docs/SDD-ILHA-ENVELOPE.md`).
 *
 * Tamanho único da janela `main` nos modos `compact`/`quick-menu`/`checklist`:
 * o maior modo (`quick-menu`) mais `ISLAND_ENVELOPE_PAD` de folga em cada lado,
 * reservada para a sombra externa que a janela recortada por forma não permite
 * hoje. A janela nunca é redimensionada nesses três modos — só o desenho dentro
 * dela muda, por CSS.
 */
export const ISLAND_ENVELOPE_PAD = 24;
export const ISLAND_ENVELOPE_SIZE: Size = {
  width: QUICK_MENU_SIZE.width + ISLAND_ENVELOPE_PAD * 2,
  height: QUICK_MENU_SIZE.height + ISLAND_ENVELOPE_PAD * 2,
};

/**
 * Raio dos painéis expandidos (`quick-menu`/`checklist`) e da superfície da
 * ilha nesses modos. Vive aqui (não em `floating-island-transition.ts`) para
 * `radiusForEnvelopeMode` poder usá-lo sem criar um ciclo de import;
 * `floating-island-transition.ts` reexporta este símbolo para quem já
 * importava de lá.
 */
export const ISLAND_EXPANDED_RADIUS_PX = 14;

/**
 * Raio de repouso da pílula compacta.
 *
 * Valor explícito, NÃO `COMPACT_SIZE.height / 2`: metade da altura desenha uma
 * cápsula (pontas semicirculares), e o desenho pedido é um retângulo
 * arredondado. Mantido junto de `ISLAND_EXPANDED_RADIUS_PX` para as duas
 * formas da ilha ficarem na mesma família de raio.
 *
 * Precisa acompanhar `--radius-pill` no `index.css`: este valor rege o recorte
 * da janela (`set_window_region`) e a superfície da ilha, enquanto a variável
 * CSS rege o conteúdo (`overflow: hidden`) e o modo `edge-collapsed`. Se os
 * dois divergirem, o recorte do conteúdo corta antes da borda pintada.
 */
export const ISLAND_COMPACT_RADIUS_PX = 12;

export type IslandEnvelopeMode = "compact" | "quick-menu" | "checklist";
export type IslandGrowthDirection = "down" | "up";
export type IslandEnvelopeRect = Position & Size;

/** Desenho de cada modo dentro do envelope. Não inclui `edge-collapsed`, que segue com janela própria. */
export function visualSizeForEnvelopeMode(mode: IslandEnvelopeMode): Size {
  if (mode === "quick-menu") return QUICK_MENU_SIZE;
  if (mode === "checklist") return CHECKLIST_SIZE;
  return COMPACT_SIZE;
}

/** Raio do recorte de janela (`set_window_region`) para cada modo do envelope. */
export function radiusForEnvelopeMode(mode: IslandEnvelopeMode): number {
  return mode === "compact" ? ISLAND_COMPACT_RADIUS_PX : ISLAND_EXPANDED_RADIUS_PX;
}

/**
 * Retângulo do desenho de `mode`, em coordenadas locais do envelope.
 *
 * Sempre centralizado na horizontal. Na vertical, encostado no topo
 * (`growth: "down"`, o padrão) ou no fundo (`growth: "up"`, perto da borda
 * inferior da tela, onde o envelope precisa crescer para cima em vez de para
 * baixo). A troca de direção move o envelope pelo delta exato do offset da
 * pílula, então a pílula não se desloca na tela — ver `resolveIslandGrowthShift`.
 */
export function islandRectForMode(
  mode: IslandEnvelopeMode,
  growth: IslandGrowthDirection = "down",
): IslandEnvelopeRect {
  const visual = visualSizeForEnvelopeMode(mode);
  const x = Math.round((ISLAND_ENVELOPE_SIZE.width - visual.width) / 2);
  const y =
    growth === "down"
      ? ISLAND_ENVELOPE_PAD
      : ISLAND_ENVELOPE_SIZE.height - ISLAND_ENVELOPE_PAD - visual.height;
  return { x, y, width: visual.width, height: visual.height };
}

/**
 * Deslocamento a somar em `envelope.y` ao trocar de "down" para "up" para
 * `mode`, de forma que o retângulo de `mode` continue no mesmo pixel de tela.
 * Para voltar de "up" para "down", soma-se o negativo.
 *
 * Negativo para todo modo mais baixo que `quick-menu`: crescer para cima
 * exige que o envelope suba na tela. Zero para `quick-menu`, que já ocupa a
 * altura inteira do envelope menos o padding dos dois lados — não sobra folga
 * vertical para a âncora mudar. Só o eixo vertical muda: a centralização
 * horizontal independe da direção.
 */
export function resolveIslandGrowthShift(mode: IslandEnvelopeMode): number {
  const down = islandRectForMode(mode, "down");
  const up = islandRectForMode(mode, "up");
  return down.y - up.y;
}

/**
 * Direção de crescimento do envelope para uma pílula em repouso em
 * `pillPosition`. Resolvida uma vez, em repouso — nunca durante um morph.
 *
 * "down" (padrão) a menos que não caiba `QUICK_MENU_SIZE.height` (o maior
 * modo) abaixo da pílula mas caiba acima: aí a expansão precisa crescer para
 * cima para não ser cortada pela borda inferior da tela. Sem monitor
 * conhecido, ou sem espaço suficiente nos dois sentidos, cai em "down" — o
 * mesmo comportamento de hoje, sujeito ao mesmo clamp de tela que qualquer
 * outra posição de janela.
 *
 * `pillPosition`/`workArea` chegam em px físicos dos call sites nativos
 * (`readWindowBounds`/`readWorkArea`); `scaleFactor` converte as constantes
 * lógicas (`COMPACT_SIZE`, `QUICK_MENU_SIZE`) para a mesma unidade antes de
 * comparar. Omitir `scaleFactor` (padrão 1) trata tudo como já lógico.
 */
export function resolveIslandGrowthDirection(input: {
  pillPosition: Position;
  workArea: MonitorInfo | null;
  scaleFactor?: number;
}): IslandGrowthDirection {
  const { pillPosition, workArea } = input;
  const scale = input.scaleFactor ?? 1;
  if (!workArea) {
    return "down";
  }

  const compactHeight = COMPACT_SIZE.height * scale;
  const quickMenuHeight = QUICK_MENU_SIZE.height * scale;

  const roomBelow =
    workArea.position.y + workArea.size.height - (pillPosition.y + compactHeight);
  const roomAbove = pillPosition.y - workArea.position.y;

  if (roomBelow >= quickMenuHeight) {
    return "down";
  }
  if (roomAbove >= quickMenuHeight) {
    return "up";
  }
  return roomBelow >= roomAbove ? "down" : "up";
}

/**
 * Posição do envelope (canto superior esquerdo) para a pílula ficar em
 * `pillPosition` na tela.
 *
 * `scaleFactor` converte o offset do modo compact (lógico) para a mesma
 * unidade de `pillPosition` — px físicos nos call sites nativos, px lógicos
 * (padrão, `scaleFactor: 1`) no CSS.
 */
export function envelopePositionForPill(input: {
  pillPosition: Position;
  growth: IslandGrowthDirection;
  scaleFactor?: number;
}): Position {
  const scale = input.scaleFactor ?? 1;
  const anchor = islandRectForMode("compact", input.growth);
  return {
    x: input.pillPosition.x - Math.round(anchor.x * scale),
    y: input.pillPosition.y - Math.round(anchor.y * scale),
  };
}

/** Inversa de `envelopePositionForPill`: onde a pílula está na tela para um envelope em `envelopePosition`. */
export function pillPositionForEnvelope(input: {
  envelopePosition: Position;
  growth: IslandGrowthDirection;
  scaleFactor?: number;
}): Position {
  const scale = input.scaleFactor ?? 1;
  const anchor = islandRectForMode("compact", input.growth);
  return {
    x: input.envelopePosition.x + Math.round(anchor.x * scale),
    y: input.envelopePosition.y + Math.round(anchor.y * scale),
  };
}

/**
 * Menor retângulo que cobre `a` e `b`. Usado para a região aplicada durante o
 * morph (ver `docs/SDD-ILHA-ENVELOPE.md` §4): larga e alta o bastante para as
 * duas formas, origem e destino, sem recortar nenhuma das duas em trânsito.
 */
export function unionRect(
  a: IslandEnvelopeRect,
  b: IslandEnvelopeRect,
): IslandEnvelopeRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * `rect` crescido em `slack` px para cada lado, sem nunca sair do envelope.
 *
 * Existe para o recorte aplicado durante o morph: a curva de abertura passa do
 * retângulo de destino antes de voltar, e um recorte colado na união exata de
 * origem e destino cortaria esse pico numa linha reta. Como o recorte só
 * precisa NÃO cortar o desenho (sobrar região é invisível — a janela é
 * transparente ali), inflar é seguro; o clamp existe porque uma região maior
 * que a janela é rejeitada pelo Windows.
 */
export function inflateRectWithinEnvelope(
  rect: IslandEnvelopeRect,
  slack: number,
): IslandEnvelopeRect {
  const left = Math.max(0, rect.x - slack);
  const top = Math.max(0, rect.y - slack);
  const right = Math.min(ISLAND_ENVELOPE_SIZE.width, rect.x + rect.width + slack);
  const bottom = Math.min(ISLAND_ENVELOPE_SIZE.height, rect.y + rect.height + slack);
  return { x: left, y: top, width: right - left, height: bottom - top };
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
