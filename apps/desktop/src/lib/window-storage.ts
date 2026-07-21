import { parsePosition, serializePosition, type Position } from "@/lib/window-position";

export const POSITION_STORAGE_KEY = "linvo:window-position";
export const CHECKLIST_POSITION_STORAGE_KEY = "linvo:checklist-window-position";
export const EDGE_MARGIN = 24;

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
