import { beforeEach, describe, expect, it, vi } from "vitest";

import { enterFloatingMode } from "@/lib/auth/enter-floating-mode";
import { updateTaskbarVisibility } from "@/lib/app-windows";
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

    await enterFloatingMode();

    expect(invokeMock).toHaveBeenCalledWith(
      "animate_window_bounds",
      expect.objectContaining({
        to: expect.objectContaining({ width: 168, height: 34 }),
      }),
    );
    expect(setSizeMock).toHaveBeenCalled();
    expect(setPositionMock).toHaveBeenCalled();
    expect(updateTaskbarVisibility).toHaveBeenCalledWith(true);
    expect(showMock).toHaveBeenCalled();
    expect(setFocusMock).toHaveBeenCalled();
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
});
