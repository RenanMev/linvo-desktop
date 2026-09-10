import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/onboarding-review-sync", () => ({
  requestOnboardingReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/panel-window", () => ({
  closePanel: vi.fn().mockResolvedValue(undefined),
}));

import { requestOnboardingReview } from "@/lib/onboarding-review-sync";
import { closePanel } from "@/lib/panel-window";
import { resetDesktopSettingsCache } from "@/lib/desktop-settings-store";
import { resetOverlayChromeCache } from "@/lib/overlay-chrome";
import { GeneralSettingsPage } from "@/pages/settings/general-settings-page";
import {
  autostartDisableMock,
  autostartEnableMock,
  autostartIsEnabledMock,
  invokeMock,
  pluginStoreData,
  resetPluginStoreMock,
} from "@/test/mocks/tauri";

describe("GeneralSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPluginStoreMock();
    resetDesktopSettingsCache();
    resetOverlayChromeCache();
    autostartIsEnabledMock.mockResolvedValue(false);
    autostartEnableMock.mockResolvedValue(undefined);
    autostartDisableMock.mockResolvedValue(undefined);
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "overlay_chrome_status") {
        return Promise.resolve({
          noActivateOk: true,
          clickThrough: false,
          excludeFromCapture: false,
          topmostGuard: false,
          win32Ok: true,
        });
      }
      if (cmd === "set_exclude_from_capture") {
        return Promise.resolve({
          noActivateOk: true,
          clickThrough: false,
          excludeFromCapture: true,
          topmostGuard: false,
          win32Ok: true,
        });
      }
      return Promise.resolve(undefined);
    });
  });

  it("requests an onboarding review and closes the panel", async () => {
    const pointer = userEvent.setup();
    render(<GeneralSettingsPage />);

    await pointer.click(
      screen.getByRole("button", { name: "Rever onboarding" }),
    );

    await waitFor(() =>
      expect(requestOnboardingReview).toHaveBeenCalledTimes(1),
    );
    expect(closePanel).toHaveBeenCalledTimes(1);
  });

  it("renders autostart and hide-from-capture switches", async () => {
    render(<GeneralSettingsPage />);

    expect(
      await screen.findByRole("switch", { name: "Abrir com o Windows" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", {
        name: "Ocultar Linvo ao compartilhar tela",
      }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByText("O assistente fica disponível depois do login."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Some do Meet e do Teams. A captura do próprio Linvo continua funcionando.",
      ),
    ).toBeInTheDocument();
  });

  it("enables autostart through the plugin", async () => {
    const pointer = userEvent.setup();
    render(<GeneralSettingsPage />);

    await pointer.click(
      await screen.findByRole("switch", { name: "Abrir com o Windows" }),
    );

    await waitFor(() => expect(autostartEnableMock).toHaveBeenCalledTimes(1));
  });

  it("persists hide-from-capture and invokes exclude from capture", async () => {
    const pointer = userEvent.setup();
    render(<GeneralSettingsPage />);

    await pointer.click(
      await screen.findByRole("switch", {
        name: "Ocultar Linvo ao compartilhar tela",
      }),
    );

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_exclude_from_capture", {
        enabled: true,
      }),
    );
    expect(pluginStoreData.get("hideFromCapture")).toBe(true);
  });
});
