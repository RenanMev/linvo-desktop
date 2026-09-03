import { beforeEach, describe, expect, it } from "vitest";

import {
  ANCHOR_STORAGE_KEY,
  CHECKLIST_POSITION_STORAGE_KEY,
  ISLAND_PILL_POSITION_STORAGE_KEY,
  loadIslandPillPosition,
  loadSavedAnchor,
  loadSavedPosition,
  POSITION_STORAGE_KEY,
  saveIslandPillPosition,
  saveSavedAnchor,
  saveSavedPosition,
} from "@/lib/window-storage";

describe("window-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(loadSavedPosition()).toBeNull();
  });

  it("round-trips a saved position through localStorage", () => {
    saveSavedPosition({ x: 120, y: 480 });
    expect(loadSavedPosition()).toEqual({ x: 120, y: 480 });
  });

  it("returns null when the stored value is corrupt", () => {
    localStorage.setItem(POSITION_STORAGE_KEY, "{ broken");
    expect(loadSavedPosition()).toBeNull();
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

  it("round-trips a saved anchor through localStorage", () => {
    saveSavedAnchor({ horizontal: "right", vertical: "bottom" });
    expect(loadSavedAnchor()).toEqual({ horizontal: "right", vertical: "bottom" });
  });

  it("returns null when the stored anchor is corrupt", () => {
    localStorage.setItem(ANCHOR_STORAGE_KEY, "{ broken");
    expect(loadSavedAnchor()).toBeNull();
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
