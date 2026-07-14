import { beforeEach, describe, expect, it } from "vitest";

import {
  loadSavedPosition,
  POSITION_STORAGE_KEY,
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
});
