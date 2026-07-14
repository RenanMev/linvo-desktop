import { parsePosition, serializePosition, type Position } from "@/lib/window-position";

export const POSITION_STORAGE_KEY = "linvo:window-position";
export const EDGE_MARGIN = 24;

export function loadSavedPosition(): Position | null {
  if (typeof localStorage === "undefined") return null;
  return parsePosition(localStorage.getItem(POSITION_STORAGE_KEY));
}

export function saveSavedPosition(pos: Position): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(POSITION_STORAGE_KEY, serializePosition(pos));
}
