import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(() => Promise.resolve("0.1.0")),
}));

vi.mock("@/lib/desktop-release-api", () => ({
  fetchDesktopRelease: vi.fn(),
}));

vi.mock("@/lib/desktop-updater", () => ({
  applyDesktopUpdate: vi.fn(() => Promise.resolve()),
  openManualDownload: vi.fn(() => Promise.resolve()),
}));

import { getVersion } from "@tauri-apps/api/app";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useDesktopUpdate } from "@/hooks/use-desktop-update";
import { fetchDesktopRelease } from "@/lib/desktop-release-api";
import { applyDesktopUpdate } from "@/lib/desktop-updater";

const release = {
  latestVersion: "0.2.0",
  minSupportedVersion: "0.1.0",
  releaseNotes: "Melhorias",
  publishedAt: "2026-08-11T12:00:00.000Z",
  downloadUrl: "https://github.com/RenanMev/linvo-desktop/releases/latest",
};

describe("useDesktopUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getVersion).mockResolvedValue("0.1.0");
    vi.mocked(fetchDesktopRelease).mockResolvedValue(release);
  });

  it("marca update disponível quando current < latest", async () => {
    const { result } = renderHook(() => useDesktopUpdate(true));

    await waitFor(() => {
      expect(result.current.status).toBe("available");
    });

    expect(result.current.blocking).toBe(false);
    expect(result.current.release?.latestVersion).toBe("0.2.0");
  });

  it("marca update obrigatório quando current < minSupported", async () => {
    vi.mocked(fetchDesktopRelease).mockResolvedValue({
      ...release,
      minSupportedVersion: "0.1.5",
    });

    const { result } = renderHook(() => useDesktopUpdate(true));

    await waitFor(() => {
      expect(result.current.status).toBe("mandatory");
    });

    expect(result.current.blocking).toBe(true);
  });

  it("aplica update ao clicar", async () => {
    const { result } = renderHook(() => useDesktopUpdate(true));

    await waitFor(() => {
      expect(result.current.status).toBe("available");
    });

    await act(async () => {
      await result.current.applyUpdate();
    });

    expect(applyDesktopUpdate).toHaveBeenCalled();
  });
});
