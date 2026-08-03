import type { Position, Size } from "@/lib/window-position";

export const ISLAND_MORPH_DURATION_MS = 260;
export const ISLAND_MORPH_WATCHDOG_MS = 80;
export const ISLAND_PAINT_WATCHDOG_MS = 80;
export const ISLAND_GUTTER_PX = 1;
export const ISLAND_EXPANDED_RADIUS_PX = 14;

export type WindowBounds = {
  position: Position;
  size: Size;
};

export type IslandRect = Position & Size;

export type IslandMorphGeometry = {
  /** Logical size of the WebView while the CSS morph is running. */
  viewport: Size;
  /** Source and destination rectangles in local logical CSS pixels. */
  from: IslandRect;
  to: IslandRect;
};

export type PreparedIslandWindowTransition = {
  geometry: IslandMorphGeometry;
  targetBounds: WindowBounds;
};

export type IslandExpandHooks = {
  onPrepare?: (geometry: IslandMorphGeometry) => Promise<void> | void;
  onResizeStart?: (geometry: IslandMorphGeometry) => Promise<void> | void;
};

export type IslandCollapseHooks = {
  /** Run the local CSS collapse before compact native bounds are committed. */
  onBeforeCommit?: (geometry: IslandMorphGeometry) => Promise<void> | void;
  /** Prevent a delayed transition from committing after it was superseded. */
  shouldCommit?: () => boolean;
};

function toLogical(value: number, scaleFactor: number): number {
  return value / Math.max(scaleFactor, Number.EPSILON);
}

function localRect(
  bounds: WindowBounds,
  viewportOrigin: Position,
  scaleFactor: number,
): IslandRect {
  return {
    x: toLogical(bounds.position.x - viewportOrigin.x, scaleFactor),
    y: toLogical(bounds.position.y - viewportOrigin.y, scaleFactor),
    width: toLogical(bounds.size.width, scaleFactor),
    height: toLogical(bounds.size.height, scaleFactor),
  };
}

/**
 * Expansion runs after the native window has jumped to `targetBounds`, so all
 * local coordinates are expressed inside the target WebView.
 */
export function resolveExpandMorphGeometry(input: {
  sourceBounds: WindowBounds;
  targetBounds: WindowBounds;
  scaleFactor: number;
}): IslandMorphGeometry {
  const { sourceBounds, targetBounds, scaleFactor } = input;
  return {
    viewport: {
      width: toLogical(targetBounds.size.width, scaleFactor),
      height: toLogical(targetBounds.size.height, scaleFactor),
    },
    from: localRect(sourceBounds, targetBounds.position, scaleFactor),
    to: localRect(targetBounds, targetBounds.position, scaleFactor),
  };
}

/**
 * Collapse runs before the native window shrinks, so both rectangles are
 * expressed inside the current expanded WebView.
 */
export function resolveCollapseMorphGeometry(input: {
  sourceBounds: WindowBounds;
  targetBounds: WindowBounds;
  scaleFactor: number;
}): IslandMorphGeometry {
  const { sourceBounds, targetBounds, scaleFactor } = input;
  return {
    viewport: {
      width: toLogical(sourceBounds.size.width, scaleFactor),
      height: toLogical(sourceBounds.size.height, scaleFactor),
    },
    from: localRect(sourceBounds, sourceBounds.position, scaleFactor),
    to: localRect(targetBounds, sourceBounds.position, scaleFactor),
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
  transform: string;
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

  return {
    transform: `translate3d(${target.x - base.x}px, ${target.y - base.y}px, 0) scale(${scaleX}, ${scaleY})`,
    scaleX,
    scaleY,
  };
}
