import type { Position, Size } from "@/lib/window-position";
import {
  ISLAND_COMPACT_RADIUS_PX,
  ISLAND_ENVELOPE_SIZE,
  islandRectForMode,
  type IslandEnvelopeMode,
  type IslandGrowthDirection,
} from "@/lib/window-mode";

// Reexportado por compatibilidade: definido em `window-mode.ts` para
// `radiusForEnvelopeMode` poder usá-lo sem criar um ciclo de import entre os
// dois módulos (ver o comentário na definição).
export { ISLAND_EXPANDED_RADIUS_PX } from "@/lib/window-mode";

/**
 * Duração do morph ao ABRIR (compact → quick-menu/checklist).
 *
 * Também é o teto usado pelos watchdogs: é a maior das duas direções, então
 * um watchdog dimensionado por ela nunca dispara antes de um fecho terminar.
 *
 * É o `visualDuration` da mola de abertura (`EXPAND_SPRING`), não o tempo
 * total: o Motion define `visualDuration` como o tempo até a forma PARECER ter
 * chegado, e a acomodação do overshoot continua depois disso. Por isso o
 * movimento lê como mais rápido que os 170ms fixos de antes, apesar do número
 * maior — o ataque é bem mais curto.
 */
export const ISLAND_MORPH_DURATION_MS = 260;

/**
 * Duração do morph ao FECHAR. Mais curta e criticamente amortecida: fechar é
 * uma confirmação, não uma apresentação — arrastar tanto quanto a abertura faz
 * a interface parecer travada.
 */
export const ISLAND_MORPH_COLLAPSE_DURATION_MS = 190;

/**
 * Fração da duração do morph que o cross-fade das superfícies leva, e fração
 * após a qual a opacidade do conteúdo de destino começa a subir.
 *
 * São frações e não valores fixos porque as duas direções têm durações
 * diferentes: com um tempo fixo, a forma que sai sumiria cedo demais no fecho
 * e tarde demais na abertura.
 *
 * O atraso do conteúdo é curto de propósito. A geometria dele não espera nada
 * — o `clip-path` abre junto com a casca, na mesma mola — então este atraso
 * rege só a opacidade, e serve apenas para o texto não aparecer no primeiro
 * quadro, quando a fresta revelada ainda é fina demais para caber qualquer
 * coisa legível. Era 0,42 quando o conteúdo só podia entrar DEPOIS da casca
 * parar; nesse valor a abertura lia como duas etapas.
 */
export const ISLAND_MORPH_FADE_RATIO = 0.42;
export const ISLAND_CONTENT_DELAY_RATIO = 0.08;

/** Deslocamento vertical do conteúdo que entra / que sai, em px. */
export const ISLAND_MORPH_CONTENT_DISTANCE_PX = 8;
export const ISLAND_MORPH_CONTENT_EXIT_DISTANCE_PX = -4;

/**
 * Quanto tempo a mola leva para ACOMODAR, como múltiplo da duração visual.
 *
 * `visualDuration` é o tempo até a forma parecer ter chegado; a mola continua
 * corrigindo o overshoot depois disso, e `onAnimationComplete` só dispara no
 * fim de verdade. Os watchdogs precisam desta escala, não da duração visual:
 * dimensionados pela duração visual eles disparavam ANTES da mola acabar, o
 * BarApp assentava o morph no meio e a forma saltava para o estado final —
 * a animação aparecia cortada pela metade.
 *
 * 2× cobre com folga o pior caso (abertura, `bounce: 0.18`). É um failsafe:
 * no caminho normal quem termina o morph é o callback do Motion, bem antes.
 */
export const ISLAND_SPRING_SETTLE_FACTOR = 2;

/** Teto de acomodação da mola de cada direção, para os watchdogs. */
export function islandMorphSettleMs(expanding: boolean): number {
  return Math.round(
    (expanding ? ISLAND_MORPH_DURATION_MS : ISLAND_MORPH_COLLAPSE_DURATION_MS) *
      ISLAND_SPRING_SETTLE_FACTOR,
  );
}

export const ISLAND_MORPH_WATCHDOG_MS = 60;
export const ISLAND_PAINT_WATCHDOG_MS = 80;
export const ISLAND_GUTTER_PX = 1;

/**
 * Folga somada ao recorte da janela enquanto o morph roda.
 *
 * A mola de abertura passa ~3,8% do retângulo de destino antes de voltar. Sem
 * esta folga o recorte — que é a união exata dos retângulos de origem e
 * destino — cortaria o pico do overshoot numa linha reta, e o efeito viraria
 * um achatamento visível justo no quadro mais expressivo da animação.
 *
 * 20px cobre o pico com sobra (o pico do quick-menu chega a ~19,7px além do
 * alvo no eixo vertical) e ainda cabe no envelope depois do clamp em
 * `inflateRectWithinEnvelope`.
 */
export const ISLAND_MORPH_REGION_SLACK_PX = 20;

/**
 * Raio da camada da pílula *durante* o cross-fade.
 *
 * `resolveRectFlip` anima essa camada via `transform: scale()`, que estica
 * `border-radius` pelos MESMOS fatores não uniformes do resto da forma
 * (~1,9× no X, ~14,4× no Y ao abrir o quick menu). Se o alcance vertical do
 * arco na escala máxima chegar à metade da altura do alvo, os arcos do topo e
 * do fundo se encontram e a forma vira um barril (cintura fina, topo e base
 * estufados) em vez de manter os lados retos.
 *
 * Quando o repouso era `COMPACT_SIZE.height / 2` (uma cápsula), esse alcance
 * batia exatamente nos 100% e o barril aparecia — daí este valor ter sido
 * fixado abaixo do raio real. Com o repouso agora em
 * `ISLAND_COMPACT_RADIUS_PX` (um retângulo arredondado, bem menor que meia
 * altura), o alcance fica em ~67% da metade da altura nos dois painéis
 * (quick-menu e checklist): sobra 33% de margem e o raio de verdade pode ser
 * usado o morph inteiro. Isso elimina o pulo de raio que existia ao assentar,
 * quando a camada trocava do valor reduzido para o de repouso.
 *
 * A margem é verificada por teste — se `ISLAND_COMPACT_RADIUS_PX` ou a altura
 * da pílula crescerem, é o teste que avisa antes do barril voltar.
 *
 * Animar `border-radius` de verdade (em vez desta aproximação por
 * `transform`) eliminaria a distorção pela raiz, mas já foi tentado nesta
 * base e piscava pior (o WebView precisa re-rasterizar a máscara arredondada
 * a cada frame, e os frames que não ficam prontos saem em branco) — ver o
 * comentário em `.floating-island-surface` no `index.css`.
 */
export const ISLAND_MORPH_COMPACT_RADIUS_PX = ISLAND_COMPACT_RADIUS_PX;

export type IslandRect = Position & Size;

export type IslandMorphGeometry = {
  /** Logical size of the WebView while the CSS morph is running. */
  viewport: Size;
  /** Source and destination rectangles in local logical CSS pixels. */
  from: IslandRect;
  to: IslandRect;
};

/**
 * Geometria do morph entre dois modos do envelope fixo (ver
 * `docs/SDD-ILHA-ENVELOPE.md`). Ao contrário do que uma expansão nativa exigia
 * antes, não depende dos bounds da janela: o envelope não muda de tamanho nem
 * de posição entre `fromMode` e `toMode`, então os dois retângulos já são os
 * retângulos de desenho de cada modo, no mesmo viewport fixo.
 */
export function resolveEnvelopeMorphGeometry(input: {
  fromMode: IslandEnvelopeMode;
  toMode: IslandEnvelopeMode;
  growth: IslandGrowthDirection;
}): IslandMorphGeometry {
  return {
    viewport: ISLAND_ENVELOPE_SIZE,
    from: islandRectForMode(input.fromMode, input.growth),
    to: islandRectForMode(input.toMode, input.growth),
  };
}

export function hasMeaningfulMorph(
  geometry: IslandMorphGeometry,
  epsilon = 0.5,
): boolean {
  return (Object.keys(geometry.from) as Array<keyof IslandRect>).some(
    (key) => Math.abs(geometry.from[key] - geometry.to[key]) > epsilon,
  );
}

export type IslandPlacement = {
  left: string;
  top: string;
  width: number;
  height: number;
};

export type IslandFlip = {
  /**
   * Forma pronta para `transform` do CSS. Mantida para quem só precisa da
   * string; o shell usa os componentes soltos abaixo, porque o Motion anima
   * `x`/`y`/`scaleX`/`scaleY` como valores independentes — é o que permite
   * interromper e redirecionar cada eixo a partir da velocidade atual.
   */
  transform: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

function rectArea(rect: IslandRect): number {
  return rect.width * rect.height;
}

function innerExtent(extent: number, inset: number): number {
  return Math.max(1, extent - inset * 2);
}

/** O menor dos dois retângulos: a pílula, em qualquer direção do morph. */
export function resolveCompactRect(geometry: IslandMorphGeometry): IslandRect {
  return rectArea(geometry.from) <= rectArea(geometry.to)
    ? geometry.from
    : geometry.to;
}

export function resolveExpandedRect(geometry: IslandMorphGeometry): IslandRect {
  return rectArea(geometry.from) <= rectArea(geometry.to)
    ? geometry.to
    : geometry.from;
}

/**
 * Offset num eixo, escrito de forma que continue certo nos dois viewports.
 *
 * A geometria é resolvida num viewport só, mas o WebView é redimensionado no
 * meio da transição — e entre o `SetWindowPos` e o próximo commit do React
 * existem frames pintados com o viewport novo e o estilo antigo. Com px puros
 * esses frames desenham a ilha no lugar errado (a pílula saltava para o canto
 * ao abrir e sumia fora do viewport ao fechar: é o "piscar").
 *
 * A saída é ancorar tudo na pílula. O offset dela é escrito como fração da
 * folga do viewport, que vale zero quando a janela tem o tamanho da própria
 * pílula e o valor cheio quando está expandida; os outros retângulos saem daí
 * por um delta constante, porque a distância entre eles na tela não muda
 * quando a janela cresce.
 */
function axisPlacement(input: {
  offset: number;
  anchorOffset: number;
  anchorExtent: number;
  viewportExtent: number;
  inset: number;
}): string {
  const { offset, anchorOffset, anchorExtent, viewportExtent, inset } = input;
  const slack = viewportExtent - anchorExtent;
  const delta = offset - anchorOffset + inset;

  if (slack <= 0) {
    return `${offset + inset}px`;
  }

  const ratio = Number((anchorOffset / slack).toFixed(6));
  if (ratio === 0) {
    return `${delta}px`;
  }

  return `calc((100% - ${anchorExtent}px) * ${ratio} + ${delta}px)`;
}

export function resolveIslandPlacement(
  rect: IslandRect,
  geometry: IslandMorphGeometry,
  inset = ISLAND_GUTTER_PX,
): IslandPlacement {
  const anchor = resolveCompactRect(geometry);

  return {
    left: axisPlacement({
      offset: rect.x,
      anchorOffset: anchor.x,
      anchorExtent: anchor.width,
      viewportExtent: geometry.viewport.width,
      inset,
    }),
    top: axisPlacement({
      offset: rect.y,
      anchorOffset: anchor.y,
      anchorExtent: anchor.height,
      viewportExtent: geometry.viewport.height,
      inset,
    }),
    width: innerExtent(rect.width, inset),
    height: innerExtent(rect.height, inset),
  };
}

/**
 * Posição direta de `rect` dentro de um viewport que não muda — o estado
 * assentado da ilha, fora de qualquer morph. Ao contrário de
 * `resolveIslandPlacement`, não precisa da âncora nem do `calc()` por
 * fração: como o envelope nunca redimensiona entre os modos
 * compact/quick-menu/checklist (ver `docs/SDD-ILHA-ENVELOPE.md`), o
 * retângulo de cada modo já vale em px absolutos.
 */
export function resolveStablePlacement(
  rect: IslandRect,
  inset = ISLAND_GUTTER_PX,
): IslandPlacement {
  return {
    left: `${rect.x + inset}px`,
    top: `${rect.y + inset}px`,
    width: innerExtent(rect.width, inset),
    height: innerExtent(rect.height, inset),
  };
}

/**
 * `clip-path` que revela apenas a área de `inner` dentro da caixa de `outer`.
 *
 * É o que costura as duas metades da transição numa só. Sem isto o conteúdo
 * de destino só podia aparecer DEPOIS que a casca terminasse de crescer (ele
 * mora no retângulo final, em tamanho final, e apareceria transbordando para
 * fora da forma ainda pequena) — e a abertura lia como duas etapas: a casca
 * cresce vazia, e então o conteúdo surge.
 *
 * Recortando o conteúdo pelo retângulo da forma de origem e animando esse
 * recorte até `inset(0…)` com a MESMA mola da casca, o conteúdo é revelado na
 * medida em que a forma abre. Nada de escalar o conteúdo: texto escalado por
 * `transform` borra e depois estala ao voltar para 1.
 *
 * Ambos os retângulos estão em coordenadas do envelope; `inset` é o mesmo
 * gutter aplicado às superfícies, para o recorte casar com o que é pintado.
 */
export function resolveRevealClipPath(
  outer: IslandRect,
  inner: IslandRect,
  radius: number,
  inset = ISLAND_GUTTER_PX,
): string {
  const outerLeft = outer.x + inset;
  const outerTop = outer.y + inset;
  const outerRight = outerLeft + innerExtent(outer.width, inset);
  const outerBottom = outerTop + innerExtent(outer.height, inset);

  const innerLeft = inner.x + inset;
  const innerTop = inner.y + inset;
  const innerRight = innerLeft + innerExtent(inner.width, inset);
  const innerBottom = innerTop + innerExtent(inner.height, inset);

  // Nunca negativo: um `inset()` negativo não expande o recorte, ele é
  // tratado como zero por alguns motores e como erro por outros.
  const top = Math.max(0, innerTop - outerTop);
  const left = Math.max(0, innerLeft - outerLeft);
  const right = Math.max(0, outerRight - innerRight);
  const bottom = Math.max(0, outerBottom - innerBottom);

  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
}

/** Recorte que não esconde nada — o estado final de `resolveRevealClipPath`. */
export function resolveFullClipPath(radius: number): string {
  return `inset(0px 0px 0px 0px round ${radius}px)`;
}

export const ISLAND_IDENTITY_TRANSFORM = "translate3d(0px, 0px, 0) scale(1, 1)";

/**
 * Transform que faz um elemento posicionado em `base` ocupar `target` (FLIP).
 * Exige `transform-origin: top left`.
 *
 * Cada superfície da ilha tem raio e borda fixos e mora no próprio retângulo;
 * o outro estado é essa mesma superfície transformada. Animar só `transform` e
 * `opacity` mantém tudo no compositor — animar `border-radius` obriga o WebView
 * a re-rasterizar a camada inteira a cada frame, e é isso que pisca.
 */
export function resolveRectFlip(
  target: IslandRect,
  base: IslandRect,
  inset = ISLAND_GUTTER_PX,
): IslandFlip {
  const scaleX = innerExtent(target.width, inset) / innerExtent(base.width, inset);
  const scaleY =
    innerExtent(target.height, inset) / innerExtent(base.height, inset);

  const x = target.x - base.x;
  const y = target.y - base.y;

  return {
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`,
    x,
    y,
    scaleX,
    scaleY,
  };
}

/** Estado sem transformação, na forma que o Motion anima. */
export const ISLAND_IDENTITY_FLIP = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
