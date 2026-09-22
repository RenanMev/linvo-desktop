import { beforeEach, describe, expect, it } from "vitest";

import {
  ANCHOR_STORAGE_KEY,
  hydrateWindowStorage,
  ISLAND_PILL_POSITION_STORAGE_KEY,
  loadIslandPillPosition,
  loadSavedAnchor,
  loadSavedPlacement,
  loadSavedPosition,
  POSITION_STORAGE_KEY,
  resetWindowStorageCache,
  saveIslandPillPosition,
  saveSavedAnchor,
  saveSavedPosition,
} from "@/lib/window-storage";
import { resetDesktopSettingsCache } from "@/lib/desktop-settings-store";
import {
  availableMonitorsMock,
  currentMonitorMock,
  pluginStoreData,
  resetPluginStoreMock,
} from "@/test/mocks/tauri";

const primary = {
  name: "DISPLAY1",
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

describe("window-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPluginStoreMock();
    resetDesktopSettingsCache();
    resetWindowStorageCache();
    availableMonitorsMock.mockReset();
    currentMonitorMock.mockReset();
    availableMonitorsMock.mockResolvedValue([primary]);
    currentMonitorMock.mockResolvedValue(primary);
  });

  it("returns null when nothing is stored", () => {
    expect(loadSavedPosition()).toBeNull();
  });

  it("round-trips a saved position through the memory cache", () => {
    saveSavedPosition({ x: 120, y: 480 });
    expect(loadSavedPosition()).toEqual({ x: 120, y: 480 });
  });

  it("returns null when no anchor is stored", () => {
    expect(loadSavedAnchor()).toBeNull();
  });

  it("round-trips a saved anchor through the memory cache", () => {
    saveSavedAnchor({ horizontal: "right", vertical: "bottom" });
    expect(loadSavedAnchor()).toEqual({
      horizontal: "right",
      vertical: "bottom",
    });
  });

  it("migrates localStorage position and anchor once", async () => {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: 80, y: 40 }));
    localStorage.setItem(
      ANCHOR_STORAGE_KEY,
      JSON.stringify({ horizontal: "left", vertical: null }),
    );

    await hydrateWindowStorage();

    expect(loadSavedPosition()).toEqual({ x: 80, y: 40 });
    expect(loadSavedAnchor()).toEqual({ horizontal: "left", vertical: null });
    expect(localStorage.getItem(POSITION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ANCHOR_STORAGE_KEY)).toBeNull();
    expect(pluginStoreData.get("placement")).toEqual({
      x: 80,
      y: 40,
      monitorId: "DISPLAY1",
    });
    expect(pluginStoreData.get("anchor")).toEqual({
      horizontal: "left",
      vertical: null,
    });
  });

  it("clamps onto the current monitor when the saved monitor disappeared", async () => {
    pluginStoreData.set("placement", {
      x: 2500,
      y: 80,
      monitorId: "GONE",
    });

    await hydrateWindowStorage();

    expect(loadSavedPosition()).toEqual({ x: 1540, y: 80 });
    expect(loadSavedPlacement()?.monitorId).toBe("DISPLAY1");
  });

  it("keeps the saved coordinates when the monitor is still present", async () => {
    pluginStoreData.set("placement", {
      x: 2000,
      y: 120,
      monitorId: "DISPLAY2",
    });
    availableMonitorsMock.mockResolvedValue([
      primary,
      {
        name: "DISPLAY2",
        position: { x: 1920, y: 0 },
        size: { width: 1920, height: 1080 },
      },
    ]);

    await hydrateWindowStorage();

    expect(loadSavedPosition()).toEqual({ x: 2000, y: 120 });
    expect(loadSavedPlacement()?.monitorId).toBe("DISPLAY2");
  });

  it("clamps onto the recognized monitor when its resolution shrank", async () => {
    pluginStoreData.set("placement", {
      x: 3500,
      y: 120,
      monitorId: "DISPLAY2",
    });
    availableMonitorsMock.mockResolvedValue([
      primary,
      {
        name: "DISPLAY2",
        position: { x: 1920, y: 0 },
        size: { width: 1280, height: 720 },
      },
    ]);

    await hydrateWindowStorage();

    // 1920 + 1280 - 380 (largura da janela da ilha): reconhecer o monitor não
    // basta, ele pode ter encolhido desde o último save.
    expect(loadSavedPosition()).toEqual({ x: 2820, y: 120 });
    expect(loadSavedPlacement()?.monitorId).toBe("DISPLAY2");
  });

  describe("island pill position", () => {
    it("returns null when nothing is stored under either key", () => {
      expect(loadIslandPillPosition()).toBeNull();
    });

    it("round-trips through the new key", () => {
      saveIslandPillPosition({ x: 300, y: 150 });
      expect(loadIslandPillPosition()).toEqual({ x: 300, y: 150 });
      expect(loadSavedPosition(ISLAND_PILL_POSITION_STORAGE_KEY)).toEqual({
        x: 300,
        y: 150,
      });
    });

    it("migrates from the legacy window position by adding the old centering offset", () => {
      saveSavedPosition({ x: 400, y: 200 }, POSITION_STORAGE_KEY);
      expect(loadIslandPillPosition()).toEqual({ x: 506, y: 200 });
    });

    it("scales the migration offset for the current DPI: the legacy value is physical", () => {
      saveSavedPosition({ x: 400, y: 200 }, POSITION_STORAGE_KEY);
      // 106 lógicos * 1.5 = 159 físicos — sem escalar, o offset logico cru
      // deixaria a pílula migrada ~53px à esquerda de onde ela realmente
      // estava em qualquer monitor que não seja 100%.
      expect(loadIslandPillPosition(1.5)).toEqual({ x: 400 + 159, y: 200 });
    });

    it("prefers the new key over the legacy one once migrated", () => {
      saveSavedPosition({ x: 400, y: 200 }, POSITION_STORAGE_KEY);
      saveIslandPillPosition({ x: 10, y: 10 });
      expect(loadIslandPillPosition()).toEqual({ x: 10, y: 10 });
    });

    it("never overwrites the legacy key, so downgrading keeps working", () => {
      saveSavedPosition({ x: 400, y: 200 }, POSITION_STORAGE_KEY);
      loadIslandPillPosition();
      saveIslandPillPosition({ x: 10, y: 10 });
      expect(loadSavedPosition(POSITION_STORAGE_KEY)).toEqual({ x: 400, y: 200 });
    });
  });
});
