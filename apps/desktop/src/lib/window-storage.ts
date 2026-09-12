import { availableMonitors, currentMonitor } from "@tauri-apps/api/window";

import { getIslandStore } from "@/lib/desktop-settings-store";
import { islandLog } from "@/lib/island-debug";
import { parseAnchor, serializeAnchor, type EdgeAnchor } from "@/lib/window-anchor";
import { COMPACT_SIZE, ISLAND_PANEL_WIDTH } from "@/lib/window-mode";
import {
  clampToMonitor,
  parsePosition,
  type MonitorInfo,
  type Position,
  type Size,
} from "@/lib/window-position";

export const POSITION_STORAGE_KEY = "linvo:window-position";
export const CHECKLIST_POSITION_STORAGE_KEY = "linvo:checklist-window-position";
export const ANCHOR_STORAGE_KEY = "linvo:window-anchor";
export const ISLAND_PILL_POSITION_STORAGE_KEY = "linvo:island-pill-position";

export const EDGE_MARGIN = 24;
export const SNAP_THRESHOLD = 40;

export type SavedIslandPlacement = {
  x: number;
  y: number;
  monitorId: string | null;
};

const PLACEMENT_STORE_KEYS: Record<string, string> = {
  [POSITION_STORAGE_KEY]: "placement",
  [CHECKLIST_POSITION_STORAGE_KEY]: "checklistPlacement",
};

const ANCHOR_STORE_KEY = "anchor";
const DEFAULT_CLAMP_SIZE: Size = {
  width: ISLAND_PANEL_WIDTH,
  height: COMPACT_SIZE.height,
};

const positionCache = new Map<string, Position | null>();
const placementCache = new Map<string, SavedIslandPlacement | null>();
let anchorCache: EdgeAnchor | null | undefined;
let hydratePromise: Promise<void> | null = null;
let persistGeneration = 0;

type MonitorLike = {
  name?: string | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
};

export function monitorIdOf(monitor: MonitorLike): string {
  const name = monitor.name?.trim();
  if (name) {
    return name;
  }
  return `${monitor.position.x},${monitor.position.y},${monitor.size.width}x${monitor.size.height}`;
}

export function toMonitorInfo(monitor: MonitorLike): MonitorInfo {
  return {
    position: { x: monitor.position.x, y: monitor.position.y },
    size: { width: monitor.size.width, height: monitor.size.height },
  };
}

function pointOnMonitor(position: Position, monitor: MonitorLike): boolean {
  return (
    position.x >= monitor.position.x &&
    position.y >= monitor.position.y &&
    position.x < monitor.position.x + monitor.size.width &&
    position.y < monitor.position.y + monitor.size.height
  );
}

function storeKeyFor(storageKey: string): string {
  return PLACEMENT_STORE_KEYS[storageKey] ?? storageKey;
}

function isPlacement(value: unknown): value is SavedIslandPlacement {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as SavedIslandPlacement;
  return (
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y) &&
    (candidate.monitorId === null || typeof candidate.monitorId === "string")
  );
}

export function resetWindowStorageCache(): void {
  persistGeneration += 1;
  positionCache.clear();
  placementCache.clear();
  anchorCache = undefined;
  hydratePromise = null;
}

export function loadSavedPosition(
  key: string = POSITION_STORAGE_KEY,
): Position | null {
  if (positionCache.has(key)) {
    return positionCache.get(key) ?? null;
  }
  return null;
}

export function loadSavedPlacement(
  key: string = POSITION_STORAGE_KEY,
): SavedIslandPlacement | null {
  if (placementCache.has(key)) {
    return placementCache.get(key) ?? null;
  }
  const position = loadSavedPosition(key);
  if (!position) {
    return null;
  }
  return { x: position.x, y: position.y, monitorId: null };
}

export function loadSavedAnchor(
  key: string = ANCHOR_STORAGE_KEY,
): EdgeAnchor | null {
  if (key !== ANCHOR_STORAGE_KEY) {
    return parseAnchor(
      typeof localStorage === "undefined" ? null : localStorage.getItem(key),
    );
  }
  if (anchorCache !== undefined) {
    return anchorCache;
  }
  return null;
}

export async function resolvePlacementMonitor(
  placement: SavedIslandPlacement | null,
): Promise<MonitorInfo | null> {
  let monitors: MonitorLike[] = [];
  let current: MonitorLike | null = null;
  try {
    monitors = await availableMonitors();
    current = await currentMonitor();
  } catch (error) {
    islandLog("window-storage:monitors:FAILED", { error: String(error) });
  }

  if (placement?.monitorId) {
    const matched = monitors.find(
      (monitor) => monitorIdOf(monitor) === placement.monitorId,
    );
    if (matched) {
      return toMonitorInfo(matched);
    }
  }

  if (placement) {
    const containing = monitors.find((monitor) =>
      pointOnMonitor(placement, monitor),
    );
    if (containing) {
      return toMonitorInfo(containing);
    }
  }

  if (current) {
    return toMonitorInfo(current);
  }
  if (monitors[0]) {
    return toMonitorInfo(monitors[0]);
  }
  return null;
}

async function clampPlacementToAvailableMonitor(
  placement: SavedIslandPlacement,
  winSize: Size = DEFAULT_CLAMP_SIZE,
): Promise<SavedIslandPlacement> {
  let monitors: MonitorLike[] = [];
  let current: MonitorLike | null = null;
  try {
    monitors = await availableMonitors();
    current = await currentMonitor();
  } catch (error) {
    islandLog("window-storage:monitors:FAILED", { error: String(error) });
    return placement;
  }

  const matched = placement.monitorId
    ? monitors.find((monitor) => monitorIdOf(monitor) === placement.monitorId)
    : monitors.find((monitor) => pointOnMonitor(placement, monitor));

  // Clampa mesmo com o monitor reconhecido: ele pode ter mudado de resolução
  // desde o último save e deixado a posição fora da área visível.
  if (matched) {
    const clamped = clampToMonitor(
      { x: placement.x, y: placement.y },
      winSize,
      toMonitorInfo(matched),
    );
    return { ...clamped, monitorId: monitorIdOf(matched) };
  }

  const fallback = current ?? monitors[0];
  if (!fallback) {
    return placement;
  }

  const clamped = clampToMonitor(
    { x: placement.x, y: placement.y },
    winSize,
    toMonitorInfo(fallback),
  );
  return { ...clamped, monitorId: monitorIdOf(fallback) };
}

async function persistPlacement(
  key: string,
  position: Position,
  generation: number,
): Promise<void> {
  let monitorId: string | null = placementCache.get(key)?.monitorId ?? null;
  try {
    const monitor = await currentMonitor();
    if (monitor) {
      monitorId = monitorIdOf(monitor);
    }
  } catch (error) {
    islandLog("window-storage:currentMonitor:FAILED", { error: String(error) });
  }

  if (generation !== persistGeneration) {
    return;
  }

  const placement: SavedIslandPlacement = {
    x: position.x,
    y: position.y,
    monitorId,
  };
  placementCache.set(key, placement);

  const store = await getIslandStore();
  if (!store || generation !== persistGeneration) {
    return;
  }
  try {
    await store.set(storeKeyFor(key), placement);
    await store.save();
  } catch (error) {
    islandLog("window-storage:save:FAILED", { error: String(error) });
  }
}

async function persistAnchor(
  anchor: EdgeAnchor,
  generation: number,
): Promise<void> {
  const store = await getIslandStore();
  if (!store || generation !== persistGeneration) {
    return;
  }
  try {
    await store.set(ANCHOR_STORE_KEY, anchor);
    await store.save();
  } catch (error) {
    islandLog("window-storage:anchor:save:FAILED", { error: String(error) });
  }
}

export function saveSavedPosition(
  pos: Position,
  key: string = POSITION_STORAGE_KEY,
): void {
  positionCache.set(key, pos);
  const existing = placementCache.get(key);
  placementCache.set(key, {
    x: pos.x,
    y: pos.y,
    monitorId: existing?.monitorId ?? null,
  });
  const generation = persistGeneration;
  void persistPlacement(key, pos, generation);
}

export function saveSavedAnchor(
  anchor: EdgeAnchor,
  key: string = ANCHOR_STORAGE_KEY,
): void {
  if (key !== ANCHOR_STORAGE_KEY) {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(key, serializeAnchor(anchor));
    return;
  }
  anchorCache = anchor;
  const generation = persistGeneration;
  void persistAnchor(anchor, generation);
}

async function migrateLocalPosition(key: string): Promise<SavedIslandPlacement | null> {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const migrated = parsePosition(localStorage.getItem(key));
  if (!migrated) {
    return null;
  }
  return { x: migrated.x, y: migrated.y, monitorId: null };
}

async function hydratePlacement(key: string): Promise<void> {
  if (positionCache.has(key)) {
    return;
  }

  const store = await getIslandStore();
  let placement: SavedIslandPlacement | null = null;
  if (store) {
    try {
      const stored = await store.get<SavedIslandPlacement>(storeKeyFor(key));
      if (isPlacement(stored)) {
        placement = stored;
      }
    } catch (error) {
      islandLog("window-storage:load:FAILED", { error: String(error) });
    }
  }

  if (!placement) {
    placement = await migrateLocalPosition(key);
    if (placement && store) {
      try {
        await store.set(storeKeyFor(key), placement);
        await store.save();
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(key);
        }
      } catch (error) {
        islandLog("window-storage:migrate:FAILED", { error: String(error) });
      }
    }
  }

  if (!placement) {
    positionCache.set(key, null);
    placementCache.set(key, null);
    return;
  }

  const clamped = await clampPlacementToAvailableMonitor(placement);
  positionCache.set(key, { x: clamped.x, y: clamped.y });
  placementCache.set(key, clamped);
  if (
    store &&
    (clamped.x !== placement.x ||
      clamped.y !== placement.y ||
      clamped.monitorId !== placement.monitorId)
  ) {
    try {
      await store.set(storeKeyFor(key), clamped);
      await store.save();
    } catch (error) {
      islandLog("window-storage:clamp:save:FAILED", { error: String(error) });
    }
  }
}

async function hydrateAnchor(): Promise<void> {
  if (anchorCache !== undefined) {
    return;
  }

  const store = await getIslandStore();
  if (store) {
    try {
      const stored = await store.get<EdgeAnchor>(ANCHOR_STORE_KEY);
      const parsed = stored
        ? parseAnchor(typeof stored === "string" ? stored : JSON.stringify(stored))
        : null;
      if (parsed) {
        anchorCache = parsed;
        return;
      }
    } catch (error) {
      islandLog("window-storage:anchor:load:FAILED", { error: String(error) });
    }
  }

  if (typeof localStorage !== "undefined") {
    const migrated = parseAnchor(localStorage.getItem(ANCHOR_STORAGE_KEY));
    if (migrated) {
      anchorCache = migrated;
      if (store) {
        try {
          await store.set(ANCHOR_STORE_KEY, migrated);
          await store.save();
          localStorage.removeItem(ANCHOR_STORAGE_KEY);
        } catch (error) {
          islandLog("window-storage:anchor:migrate:FAILED", {
            error: String(error),
          });
        }
      }
      return;
    }
  }

  anchorCache = null;
}

async function doHydrate(): Promise<void> {
  await hydratePlacement(POSITION_STORAGE_KEY);
  await hydratePlacement(CHECKLIST_POSITION_STORAGE_KEY);
  await hydratePlacement(ISLAND_PILL_POSITION_STORAGE_KEY);
  await hydrateAnchor();
}

export async function hydrateWindowStorage(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = doHydrate();
  }
  return hydratePromise;
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
