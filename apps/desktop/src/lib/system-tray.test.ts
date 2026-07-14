import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTrayMenuItems } from "@/lib/system-tray";
import { defaultTrayHandlers } from "@/lib/tray-handlers";

const trayNewMock = vi.fn<
  (options: { id?: string }) => Promise<{
    setMenu: typeof traySetMenuMock;
    setTooltip: typeof traySetTooltipMock;
  }>
>();
const trayGetByIdMock = vi.fn<
  (id: string) => Promise<{
    setMenu: typeof traySetMenuMock;
    setTooltip: typeof traySetTooltipMock;
  } | null>
>();
const traySetMenuMock = vi.fn(() => Promise.resolve());
const traySetTooltipMock = vi.fn(() => Promise.resolve());

vi.mock("@tauri-apps/api/app", () => ({
  defaultWindowIcon: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: {
    new: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock("@tauri-apps/api/tray", () => ({
  TrayIcon: {
    getById: (id: string) => trayGetByIdMock(id),
    new: (options: { id?: string }) => trayNewMock(options),
  },
}));

vi.mock("@/lib/app-windows", () => ({
  hideAllWindows: vi.fn(),
  isAnyWindowVisible: vi.fn(() => Promise.resolve(false)),
  showMainBar: vi.fn(),
  toggleAppVisibility: vi.fn(),
}));

describe("initSystemTray", () => {
  beforeEach(() => {
    vi.resetModules();
    trayNewMock.mockReset();
    trayGetByIdMock.mockReset();
    trayGetByIdMock.mockResolvedValue(null);
    trayNewMock.mockResolvedValue({
      setMenu: traySetMenuMock,
      setTooltip: traySetTooltipMock,
    });
  });

  it("creates only one tray icon when called concurrently", async () => {
    const { initSystemTray: init } = await import("@/lib/system-tray");

    await Promise.all([init(), init()]);

    expect(trayNewMock).toHaveBeenCalledTimes(1);
    expect(trayNewMock.mock.calls[0]?.[0]).toMatchObject({
      id: "linvo-desktop-tray",
    });
  });

  it("reuses existing tray by id instead of creating a new one", async () => {
    const existingTray = {
      setMenu: traySetMenuMock,
      setTooltip: traySetTooltipMock,
    };
    trayGetByIdMock.mockResolvedValue(existingTray);

    const { initSystemTray: init } = await import("@/lib/system-tray");

    await init();

    expect(trayNewMock).not.toHaveBeenCalled();
    expect(trayGetByIdMock).toHaveBeenCalledWith("linvo-desktop-tray");
  });
});

describe("buildTrayMenuItems", () => {
  it("builds auth phase menu with open, hide and quit", () => {
    const items = buildTrayMenuItems(
      { phase: "unauthenticated", user: null },
      defaultTrayHandlers,
    );

    const labels = items
      .filter((item) => typeof item === "object" && "text" in item)
      .map((item) => (item as { text: string }).text);

    expect(labels).toEqual([
      "Abrir Linvo Desktop",
      "Ocultar",
      "Sair",
    ]);
  });

  it("builds floating menu with bar, chat, settings and hide all", () => {
    const items = buildTrayMenuItems(
      {
        phase: "floating",
        user: {
          id: "1",
          name: "Renan",
          email: "renan@test.com",
          createdAt: "2026-01-01",
        },
      },
      defaultTrayHandlers,
    );

    const labels = items
      .filter((item) => typeof item === "object" && "text" in item)
      .map((item) => (item as { text: string }).text);

    expect(labels).toEqual([
      "Mostrar barra",
      "Abrir chat",
      "Abrir configurações",
      "Ocultar tudo",
      "Sair",
    ]);
  });

  it("disables chat and settings when user is missing in floating phase", () => {
    const items = buildTrayMenuItems(
      { phase: "floating", user: null },
      defaultTrayHandlers,
    );

    const chat = items.find(
      (item) =>
        typeof item === "object" &&
        "id" in item &&
        item.id === "open-chat",
    ) as { enabled?: boolean } | undefined;

    const settings = items.find(
      (item) =>
        typeof item === "object" &&
        "id" in item &&
        item.id === "open-settings",
    ) as { enabled?: boolean } | undefined;

    expect(chat?.enabled).toBe(false);
    expect(settings?.enabled).toBe(false);
  });
});
