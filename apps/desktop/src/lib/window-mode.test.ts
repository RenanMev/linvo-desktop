import { describe, expect, it } from "vitest";

import { COMPACT_SIZE, PANEL_SIZE } from "@/lib/window-mode";

describe("window sizes", () => {
  it("defines compact bar dimensions", () => {
    expect(COMPACT_SIZE).toEqual({ width: 140, height: 40 });
  });

  it("defines panel dimensions", () => {
    expect(PANEL_SIZE).toEqual({ width: 1200, height: 800 });
  });
});
