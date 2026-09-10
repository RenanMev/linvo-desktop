import { beforeEach, describe, expect, it, vi } from "vitest";

import { closePanel, minimizePanel, openPanel, PANEL_NAVIGATE_EVENT } from "@/lib/panel-window";
import { invokeMock, panelWindowMock, windowMock } from "@/test/mocks/tauri";

describe("panel-window", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.mocked(panelWindowMock.minimize).mockClear();
    vi.mocked(windowMock.minimize).mockClear();
  });

  it("opens panel with route", async () => {
    await openPanel("/chat");

    expect(invokeMock).toHaveBeenCalledWith("panel_open", { route: "/chat" });
  });

  it("closes panel", async () => {
    await closePanel();

    expect(invokeMock).toHaveBeenCalledWith("panel_close");
  });

  it("minimizes the panel window, not the floating bar", async () => {
    await minimizePanel();

    expect(panelWindowMock.minimize).toHaveBeenCalledTimes(1);
    expect(windowMock.minimize).not.toHaveBeenCalled();
  });

  it("exports navigate event name", () => {
    expect(PANEL_NAVIGATE_EVENT).toBe("panel://navigate");
  });
});
