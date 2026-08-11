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
  isAllowedManualDownloadUrl: vi.fn((url: string) =>
    url.startsWith("https://github.com/RenanMev/linvo-desktop/"),
  ),
}));

import { getVersion } from "@tauri-apps/api/app";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useDesktopUpdate } from "@/hooks/use-desktop-update";
import { fetchDesktopRelease } from "@/lib/desktop-release-api";
import {
  applyDesktopUpdate,
  openManualDownload,
} from "@/lib/desktop-updater";

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
    vi.mocked(applyDesktopUpdate).mockResolvedValue(undefined);
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

  it("não deixa o poll sobrescrever status updating", async () => {
    let resolveUpdate: (() => void) | undefined;
    vi.mocked(applyDesktopUpdate).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    const { result } = renderHook(() => useDesktopUpdate(true));

    await waitFor(() => {
      expect(result.current.status).toBe("available");
    });

    let applyPromise: Promise<void> | undefined;
    act(() => {
      applyPromise = result.current.applyUpdate();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("updating");
    });

    vi.mocked(fetchDesktopRelease).mockResolvedValue({
      ...release,
      latestVersion: "0.3.0",
    });

    await act(async () => {
      await fetchDesktopRelease();
    });

    expect(result.current.status).toBe("updating");

    await act(async () => {
      resolveUpdate?.();
      await applyPromise;
    });
  });

  it("mostra erro quando a verificação falha", async () => {
    vi.mocked(fetchDesktopRelease).mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useDesktopUpdate(true));

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("offline");
  });

  it("mantém blocking quando enabled oscila", async () => {
    vi.mocked(fetchDesktopRelease).mockResolvedValue({
      ...release,
      minSupportedVersion: "0.1.5",
    });

    const { result, rerender } = renderHook(
      ({ enabled }) => useDesktopUpdate(enabled),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("mandatory");
    });

    rerender({ enabled: false });
    expect(result.current.blocking).toBe(true);
    expect(result.current.status).toBe("mandatory");
  });

  it("bloqueia download manual fora da allowlist", async () => {
    vi.mocked(fetchDesktopRelease).mockResolvedValue({
      ...release,
      downloadUrl: "https://evil.example/payload",
    });

    const { result } = renderHook(() => useDesktopUpdate(true));

    await waitFor(() => {
      expect(result.current.status).toBe("available");
    });

    await act(async () => {
      await result.current.openDownload();
    });

    expect(openManualDownload).not.toHaveBeenCalled();
    expect(result.current.error).toBe("URL de download não permitida");
  });
});
