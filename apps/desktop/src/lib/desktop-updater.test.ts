import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

import { isAllowedManualDownloadUrl } from "@/lib/desktop-updater";

describe("isAllowedManualDownloadUrl", () => {
  it("aceita releases do repositório oficial", () => {
    expect(
      isAllowedManualDownloadUrl(
        "https://github.com/RenanMev/linvo-desktop/releases/latest",
      ),
    ).toBe(true);
  });

  it("rejeita hosts e esquemas externos", () => {
    expect(
      isAllowedManualDownloadUrl(
        "http://github.com/RenanMev/linvo-desktop/releases/latest",
      ),
    ).toBe(false);
    expect(
      isAllowedManualDownloadUrl(
        "https://evil.example/RenanMev/linvo-desktop/releases/latest",
      ),
    ).toBe(false);
    expect(
      isAllowedManualDownloadUrl(
        "https://github.com/other/repo/releases/latest",
      ),
    ).toBe(false);
  });
});
