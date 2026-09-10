import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  notifyDesktopEvent,
  resetNotificationPermissionAsked,
} from "@/lib/desktop-notifications";
import { windowMock } from "@/test/mocks/tauri";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

describe("notifyDesktopEvent", () => {
  beforeEach(() => {
    resetNotificationPermissionAsked();
    vi.mocked(isPermissionGranted).mockReset();
    vi.mocked(requestPermission).mockReset();
    vi.mocked(sendNotification).mockReset();
    vi.mocked(isPermissionGranted).mockResolvedValue(true);
    vi.mocked(requestPermission).mockResolvedValue("granted");
    windowMock.isVisible.mockResolvedValue(true);
  });

  it("does not notify when the island is visible", async () => {
    windowMock.isVisible.mockResolvedValue(true);

    await notifyDesktopEvent("Sessão expirada. Faça login novamente.");

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("notifies 401 copy only when the island is hidden", async () => {
    windowMock.isVisible.mockResolvedValue(false);

    await notifyDesktopEvent("Sessão expirada. Faça login novamente.");

    expect(sendNotification).toHaveBeenCalledWith({
      title: "Linvo Desktop",
      body: "Sessão expirada. Faça login novamente.",
    });
  });

  it("notifies network errors when onlyIfHidden is false even if visible", async () => {
    windowMock.isVisible.mockResolvedValue(true);

    await notifyDesktopEvent("Markdown do procedure pronto para revisão.", {
      onlyIfHidden: false,
    });

    expect(sendNotification).toHaveBeenCalled();
  });

  it("asks notification permission at most once per session", async () => {
    windowMock.isVisible.mockResolvedValue(false);
    vi.mocked(isPermissionGranted).mockResolvedValue(false);
    vi.mocked(requestPermission).mockResolvedValue("denied");

    await notifyDesktopEvent("Sem conexão com a API.");
    await notifyDesktopEvent("Sem conexão com a API.");

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
