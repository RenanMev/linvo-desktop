import { Store } from "@tauri-apps/plugin-store";

import { islandLog } from "@/lib/island-debug";

export const ISLAND_STORE_FILE = "island.json";
export const HIDE_FROM_CAPTURE_KEY = "hideFromCapture";

type IslandJsonStore = {
  get: <T>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  save: () => Promise<void>;
};

let storeHandle: IslandJsonStore | null = null;
let storePromise: Promise<IslandJsonStore | null> | null = null;
let hideFromCaptureCache = false;

export function loadHideFromCapture(): boolean {
  return hideFromCaptureCache;
}

export function resetDesktopSettingsCache(): void {
  hideFromCaptureCache = false;
  storeHandle = null;
  storePromise = null;
}

export async function getIslandStore(): Promise<IslandJsonStore | null> {
  if (storeHandle) {
    return storeHandle;
  }
  if (!storePromise) {
    storePromise = Store.load(ISLAND_STORE_FILE)
      .then((store) => {
        storeHandle = store;
        return store;
      })
      .catch((error: unknown) => {
        islandLog("store:load:FAILED", { error: String(error) });
        storePromise = null;
        return null;
      });
  }
  return storePromise;
}

export async function hydrateDesktopSettings(): Promise<void> {
  const store = await getIslandStore();
  if (!store) {
    return;
  }
  try {
    const value = await store.get<boolean>(HIDE_FROM_CAPTURE_KEY);
    hideFromCaptureCache = value === true;
  } catch (error) {
    islandLog("store:hideFromCapture:load:FAILED", { error: String(error) });
  }
}

export async function saveHideFromCapture(enabled: boolean): Promise<void> {
  hideFromCaptureCache = enabled;
  const store = await getIslandStore();
  if (!store) {
    return;
  }
  try {
    await store.set(HIDE_FROM_CAPTURE_KEY, enabled);
    await store.save();
  } catch (error) {
    islandLog("store:hideFromCapture:save:FAILED", { error: String(error) });
  }
}
