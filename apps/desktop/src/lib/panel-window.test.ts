import { beforeEach, describe, expect, it } from "vitest";

import { closePanel, openPanel, PANEL_NAVIGATE_EVENT } from "@/lib/panel-window";
import { invokeMock } from "@/test/mocks/tauri";

describe("panel-window", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it("opens panel with route", async () => {
    await openPanel("/chat");

    expect(invokeMock).toHaveBeenCalledWith("panel_open", { route: "/chat" });
  });

  it("closes panel", async () => {
    await closePanel();

    expect(invokeMock).toHaveBeenCalledWith("panel_close");
  });

  it("exports navigate event name", () => {
    expect(PANEL_NAVIGATE_EVENT).toBe("panel://navigate");
  });
});
