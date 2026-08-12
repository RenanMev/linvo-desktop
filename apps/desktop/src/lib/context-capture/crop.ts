export type Point = { x: number; y: number };

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Size = { width: number; height: number };

/**
 * Arrastar da direita para a esquerda (ou de baixo para cima) produz largura
 * ou altura negativa. Normalizar antes de qualquer outra conta evita que o
 * resto do pipeline precise saber a direção do arrasto.
 */
export function normalizeRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function clampRectToBounds(rect: Rect, bounds: Size): Rect {
  const x = Math.max(0, Math.min(rect.x, bounds.width));
  const y = Math.max(0, Math.min(rect.y, bounds.height));
  const right = Math.max(0, Math.min(rect.x + rect.width, bounds.width));
  const bottom = Math.max(0, Math.min(rect.y + rect.height, bounds.height));

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

/**
 * Converte um retângulo em coordenadas do elemento exibido para coordenadas do
 * frame original. A imagem no preview aparece redimensionada, então recortar
 * direto com as coordenadas da tela pegaria a região errada.
 */
export function scaleRectToSource(
  rect: Rect,
  displaySize: Size,
  sourceSize: Size,
): Rect {
  if (displaySize.width <= 0 || displaySize.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scaleX = sourceSize.width / displaySize.width;
  const scaleY = sourceSize.height / displaySize.height;

  const scaled = {
    x: Math.round(rect.x * scaleX),
    y: Math.round(rect.y * scaleY),
    width: Math.round(rect.width * scaleX),
    height: Math.round(rect.height * scaleY),
  };

  // Arredondar cada lado pode empurrar o retângulo para fora por 1px.
  return clampRectToBounds(scaled, sourceSize);
}

/**
 * Inverso de `scaleRectToSource`: leva um retângulo do frame para o elemento
 * exibido. O magnetismo devolve retângulos em pixels físicos da tela, e é
 * assim que eles viram um destaque alinhado com o que o usuário está vendo.
 */
export function scaleRectToDisplay(
  rect: Rect,
  sourceSize: Size,
  displaySize: Size,
): Rect {
  if (sourceSize.width <= 0 || sourceSize.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scaleX = displaySize.width / sourceSize.width;
  const scaleY = displaySize.height / sourceSize.height;

  return {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

/**
 * Converte um ponto do elemento exibido para o frame original. Sem isto o
 * magnetismo consultaria o Windows com coordenadas CSS, que só coincidem com
 * as físicas quando o monitor está em 100%.
 */
export function scalePointToSource(
  point: Point,
  displaySize: Size,
  sourceSize: Size,
): Point {
  if (displaySize.width <= 0 || displaySize.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.round((point.x * sourceSize.width) / displaySize.width),
    y: Math.round((point.y * sourceSize.height) / displaySize.height),
  };
}

export type SnapTarget = Rect & { kind: "window" | "monitor" };

function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

/**
 * Escolhe o alvo sob o cursor. Janelas vêm do `EnumWindows` já em ordem de
 * z-order (topo primeiro), então a primeira que contém o ponto é a que o
 * usuário está vendo; sobrando só a área de trabalho, vale o monitor — é o que
 * permite mirar uma tela inteira num setup de múltiplos monitores.
 */
export function pickSnapTarget<T extends SnapTarget>(
  point: Point,
  targets: readonly T[],
): T | null {
  return (
    targets.find((t) => t.kind === "window" && containsPoint(t, point)) ??
    targets.find((t) => t.kind === "monitor" && containsPoint(t, point)) ??
    null
  );
}

export const MIN_CROP_SIZE = 16;

/**
 * Um clique simples no preview vira um retângulo de poucos pixels. Tratar isso
 * como recorte entregaria uma imagem inútil, então abaixo do mínimo o recorte
 * é descartado e vale o frame inteiro.
 */
export function isRectUsable(rect: Rect, minSize = MIN_CROP_SIZE): boolean {
  return rect.width >= minSize && rect.height >= minSize;
}

export function rectToCssStyle(rect: Rect): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}
