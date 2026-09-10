import { beforeEach, describe, expect, it } from "vitest";

import {
  ANCHOR_STORAGE_KEY,
  CHECKLIST_POSITION_STORAGE_KEY,
  hydrateWindowStorage,
  loadSavedAnchor,
  loadSavedPlacement,
  loadSavedPosition,
  POSITION_STORAGE_KEY,
  resetWindowStorageCache,
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

  it("stores checklist position under a separate key", () => {
    saveSavedPosition({ x: 10, y: 20 }, CHECKLIST_POSITION_STORAGE_KEY);
    expect(loadSavedPosition()).toBeNull();
    expect(loadSavedPosition(CHECKLIST_POSITION_STORAGE_KEY)).toEqual({
      x: 10,
      y: 20,
    });
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

  it("migrates localStorage position, anchor and checklist once", async () => {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: 80, y: 40 }));
    localStorage.setItem(
      CHECKLIST_POSITION_STORAGE_KEY,
      JSON.stringify({ x: 12, y: 18 }),
    );
    localStorage.setItem(
      ANCHOR_STORAGE_KEY,
      JSON.stringify({ horizontal: "left", vertical: null }),
    );

    await hydrateWindowStorage();

    expect(loadSavedPosition()).toEqual({ x: 80, y: 40 });
    expect(loadSavedPosition(CHECKLIST_POSITION_STORAGE_KEY)).toEqual({
      x: 12,
      y: 18,
    });
    expect(loadSavedAnchor()).toEqual({ horizontal: "left", vertical: null });
    expect(localStorage.getItem(POSITION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CHECKLIST_POSITION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ANCHOR_STORAGE_KEY)).toBeNull();
    expect(pluginStoreData.get("placement")).toEqual({
      x: 80,
      y: 40,
      monitorId: "DISPLAY1",
    });
    expect(pluginStoreData.get("checklistPlacement")).toEqual({
      x: 12,
      y: 18,
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
});
