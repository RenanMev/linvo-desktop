import { parseAnchor, serializeAnchor, type EdgeAnchor } from "@/lib/window-anchor";
import { parsePosition, serializePosition, type Position } from "@/lib/window-position";

export const POSITION_STORAGE_KEY = "linvo:window-position";
export const CHECKLIST_POSITION_STORAGE_KEY = "linvo:checklist-window-position";
export const ANCHOR_STORAGE_KEY = "linvo:window-anchor";
export const ISLAND_PILL_POSITION_STORAGE_KEY = "linvo:island-pill-position";

/** Margem de repouso do posicionamento inicial (sem relação com o snap). */
export const EDGE_MARGIN = 24;

/** Distância, em pixels, dentro da qual soltar o arraste gruda na borda. */
export const SNAP_THRESHOLD = 40;

export function loadSavedPosition(
  key: string = POSITION_STORAGE_KEY,
): Position | null {
  if (typeof localStorage === "undefined") return null;
  return parsePosition(localStorage.getItem(key));
}

export function saveSavedPosition(
  pos: Position,
  key: string = POSITION_STORAGE_KEY,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, serializePosition(pos));
}

export function loadSavedAnchor(
  key: string = ANCHOR_STORAGE_KEY,
): EdgeAnchor | null {
  if (typeof localStorage === "undefined") return null;
  return parseAnchor(localStorage.getItem(key));
}

export function saveSavedAnchor(
  anchor: EdgeAnchor,
  key: string = ANCHOR_STORAGE_KEY,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, serializeAnchor(anchor));
}

/**
 * Offset horizontal lógico da pílula dentro da janela pré-envelope (380px de
 * largura, pílula de 168px centralizada por dentro): `(380 - 168) / 2`.
 *
 * Usado só para migrar, uma vez, a posição salva por versões anteriores ao
 * envelope fixo (ver `docs/SDD-ILHA-ENVELOPE.md`): a posição salva passava a
 * ser a do canto da janela, e agora é a da pílula na tela.
 */
const LEGACY_WINDOW_TO_PILL_OFFSET_X_LOGICAL = 106;

/**
 * Posição salva da pílula, em px físicos — mesma unidade que `POSITION_STORAGE_KEY`
 * sempre guardou (`win.outerPosition()` é físico, e nunca houve conversão no
 * limite da persistência). Migra da chave antiga na primeira leitura se a
 * chave nova ainda não existir; não regrava a antiga, para permitir rollback
 * de versão sem perder a posição do usuário.
 *
 * `scaleFactor` (a escala atual do monitor) converte o offset da migração —
 * definido em px lógicos — para a mesma unidade física do valor legado.
 */
export function loadIslandPillPosition(scaleFactor = 1): Position | null {
  const direct = loadSavedPosition(ISLAND_PILL_POSITION_STORAGE_KEY);
  if (direct) {
    return direct;
  }
  const legacy = loadSavedPosition(POSITION_STORAGE_KEY);
  if (!legacy) {
    return null;
  }
  return {
    x: legacy.x + Math.round(LEGACY_WINDOW_TO_PILL_OFFSET_X_LOGICAL * scaleFactor),
    y: legacy.y,
  };
}

export function saveIslandPillPosition(pos: Position): void {
  saveSavedPosition(pos, ISLAND_PILL_POSITION_STORAGE_KEY);
}
