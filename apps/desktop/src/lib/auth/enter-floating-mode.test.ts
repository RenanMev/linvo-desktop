import { beforeEach, describe, expect, it, vi } from "vitest";

import { enterFloatingMode } from "@/lib/auth/enter-floating-mode";
import { updateTaskbarVisibility } from "@/lib/app-windows";
import { ISLAND_ENVELOPE_SIZE } from "@/lib/window-mode";
import {
  invokeMock,
  setDecorationsMock,
  setFocusMock,
  setPositionMock,
  setSizeMock,
  showMock,
} from "@/test/mocks/tauri";

vi.mock("@/lib/app-windows", () => ({
  updateTaskbarVisibility: vi.fn(() => Promise.resolve()),
}));

describe("enterFloatingMode", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setPositionMock.mockClear();
    setSizeMock.mockClear();
    showMock.mockClear();
    setFocusMock.mockClear();
    vi.mocked(updateTaskbarVisibility).mockClear();
  });

  it("falls back to setSize/setPosition when animate_window_bounds rejects", async () => {
    invokeMock.mockRejectedValue(new Error("SetWindowPos failed"));

    const growth = await enterFloatingMode();

    expect(invokeMock).toHaveBeenCalledWith(
      "animate_window_bounds",
      expect.objectContaining({
        // Janela nasce no tamanho do envelope fixo, não no da pílula (ver
        // docs/SDD-ILHA-ENVELOPE.md) — ela não muda mais de tamanho ao abrir
        // o quick menu ou o checklist.
        to: expect.objectContaining({
          width: ISLAND_ENVELOPE_SIZE.width,
          height: ISLAND_ENVELOPE_SIZE.height,
        }),
      }),
    );
    expect(setSizeMock).toHaveBeenCalled();
    expect(setPositionMock).toHaveBeenCalled();
    expect(updateTaskbarVisibility).toHaveBeenCalledWith(true);
    expect(showMock).toHaveBeenCalled();
    expect(setFocusMock).toHaveBeenCalled();
    // Monitor 1920x1080 sem posição salva: a pílula nasce no topo
    // centralizado, com espaço de sobra abaixo para o quick menu — cresce
    // para baixo.
    expect(growth).toBe("down");
  });

  it("animates before applying compact window flags", async () => {
    invokeMock.mockResolvedValue(true);
    setDecorationsMock.mockClear();

    await enterFloatingMode();

    expect(invokeMock).toHaveBeenCalled();
    expect(setDecorationsMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      invokeMock.mock.invocationCallOrder[0]!,
    );
  });

  it("applies the compact region for the resolved growth direction", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "monitor_work_area") {
        return Promise.resolve({ x: 0, y: 0, width: 1920, height: 1080 });
      }
      return Promise.resolve(true);
    });

    await enterFloatingMode();

    const regionCalls = invokeMock.mock.calls.filter(
      (call) => call[0] === "set_window_region",
    );
    expect(regionCalls).toHaveLength(1);
  });
});
