import { describe, expect, it } from "vitest";

import { COMPACT_SIZE, PANEL_SIZE, QUICK_MENU_SIZE } from "@/lib/window-mode";

describe("window sizes", () => {
  it("defines compact bar dimensions", () => {
    expect(COMPACT_SIZE).toEqual({ width: 168, height: 34 });
  });

  it("defines panel dimensions", () => {
    expect(PANEL_SIZE).toEqual({ width: 1200, height: 800 });
  });

  it("defines quick-menu dimensions", () => {
    expect(QUICK_MENU_SIZE).toEqual({ width: 380, height: 520 });
  });
});
