import { currentMonitor } from "@tauri-apps/api/window";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readWorkArea } from "@/lib/window-work-area";
import { invokeMock } from "@/test/mocks/tauri";

type MockMonitor = Awaited<ReturnType<typeof currentMonitor>>;

function mockMonitor(position: { x: number; y: number }, size: { width: number; height: number }): MockMonitor {
  return { position, size } as unknown as MockMonitor;
}

describe("readWorkArea", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.mocked(currentMonitor).mockReset();
    vi.mocked(currentMonitor).mockResolvedValue(
      mockMonitor({ x: 0, y: 0 }, { width: 1920, height: 1080 }),
    );
  });

  it("uses the Rust work area when the command succeeds", async () => {
    invokeMock.mockResolvedValueOnce({ x: 0, y: 0, width: 1920, height: 1040 });

    const result = await readWorkArea();

    expect(invokeMock).toHaveBeenCalledWith("monitor_work_area");
    expect(result).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1040 },
    });
  });

  it("falls back to currentMonitor bounds when the command fails", async () => {
    invokeMock.mockRejectedValueOnce(new Error("no such command"));

    const result = await readWorkArea();

    expect(result).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
    });
  });

  it("returns null when the command fails and no monitor is detected", async () => {
    invokeMock.mockRejectedValueOnce(new Error("no such command"));
    vi.mocked(currentMonitor).mockResolvedValueOnce(null);

    const result = await readWorkArea();

    expect(result).toBeNull();
  });
});
