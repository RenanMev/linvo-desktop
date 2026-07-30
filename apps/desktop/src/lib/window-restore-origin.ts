import type { Position, Size } from "@/lib/window-position";

/**
 * Origem exata da pílula antes de expandir, para que o collapse a devolva no
 * mesmo pixel.
 *
 * Por que não bastam as contas de centro: quando a diferença de tamanho é
 * ímpar, `(a - b) / 2` cai em meio pixel, e `Math.round` desempata sempre para
 * +∞ (`round(-132.5) === -132`, mas `round(132.5) === 133`). Expandir e colapsar
 * então não se cancelam e a barra escorrega 1px por ciclo de abrir/fechar. Em
 * escala 1.0 os tamanhos são pares e o erro não aparece; em 125%/150%/175% sim.
 */
export type RestoreOrigin = {
  /** Onde a pílula estava imediatamente antes de crescer. */
  compactPosition: Position;
  /** Bounds que a expansão aplicou — servem para detectar interferência. */
  expandedPosition: Position;
  expandedSize: Size;
};

export type RestoreOriginKey = "quick-menu" | "checklist" | "edge";

const origins = new Map<RestoreOriginKey, RestoreOrigin>();

export function rememberRestoreOrigin(
  key: RestoreOriginKey,
  origin: RestoreOrigin,
): void {
  origins.set(key, origin);
}

export function loadRestoreOrigin(key: RestoreOriginKey): RestoreOrigin | null {
  return origins.get(key) ?? null;
}

export function clearRestoreOrigin(key: RestoreOriginKey): void {
  origins.delete(key);
}

/**
 * Posição de volta da pílula, ou `null` quando não é possível confiar na origem.
 *
 * Só vale se a janela expandida continua exatamente onde a expansão a deixou.
 * Se o usuário arrastou ou redimensionou o painel, a intenção dele vence e quem
 * chama cai no cálculo por centro.
 */
export function resolveRestorePosition(input: {
  origin: RestoreOrigin | null;
  currentPosition: Position;
  currentSize: Size;
}): Position | null {
  const { origin, currentPosition, currentSize } = input;
  if (!origin) {
    return null;
  }

  const untouched =
    origin.expandedPosition.x === currentPosition.x &&
    origin.expandedPosition.y === currentPosition.y &&
    origin.expandedSize.width === currentSize.width &&
    origin.expandedSize.height === currentSize.height;

  return untouched ? origin.compactPosition : null;
}
