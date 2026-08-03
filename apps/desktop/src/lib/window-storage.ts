import { parseAnchor, serializeAnchor, type EdgeAnchor } from "@/lib/window-anchor";
import { parsePosition, serializePosition, type Position } from "@/lib/window-position";

export const POSITION_STORAGE_KEY = "linvo:window-position";
export const CHECKLIST_POSITION_STORAGE_KEY = "linvo:checklist-window-position";
export const ANCHOR_STORAGE_KEY = "linvo:window-anchor";

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
