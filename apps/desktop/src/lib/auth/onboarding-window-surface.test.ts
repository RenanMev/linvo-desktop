import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyWindowSurfaceConfig: vi.fn(),
  readWorkArea: vi.fn(),
}));

vi.mock("@/lib/auth/apply-window-surface", () => ({
  applyWindowSurfaceConfig: mocks.applyWindowSurfaceConfig,
}));

vi.mock("@/lib/window-work-area", () => ({
  readWorkArea: mocks.readWorkArea,
}));

import {
  applyOnboardingWindowSurface,
  resolveOnboardingWindowSize,
} from "@/lib/auth/onboarding-window-surface";
import {
  ONBOARDING_MIN_SIZE,
  ONBOARDING_SIZE,
} from "@/lib/window-mode";
import { windowMock } from "@/test/mocks/tauri";

describe("resolveOnboardingWindowSize", () => {
  it("uses the default size in a large work area", () => {
    expect(
      resolveOnboardingWindowSize({
        position: { x: 0, y: 0 },
        size: { width: 1366, height: 768 },
      }),
    ).toEqual(ONBOARDING_SIZE);
  });

  it("clamps each axis to the available work area", () => {
    expect(
      resolveOnboardingWindowSize({
        position: { x: 0, y: 0 },
        size: { width: 580, height: 600 },
      }),
    ).toEqual({ width: 580, height: 600 });
  });

  it("never returns a size below the minimum", () => {
    expect(
      resolveOnboardingWindowSize({
        position: { x: 0, y: 0 },
        size: { width: 480, height: 440 },
      }),
    ).toEqual(ONBOARDING_MIN_SIZE);
  });

  it("falls back to the default size without a work area", () => {
    expect(resolveOnboardingWindowSize(null)).toEqual(ONBOARDING_SIZE);
  });
});

describe("applyOnboardingWindowSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(windowMock.scaleFactor).mockResolvedValue(1);
    mocks.readWorkArea.mockResolvedValue(null);
    mocks.applyWindowSurfaceConfig.mockResolvedValue(undefined);
  });

  it("applies the onboarding surface with the resolved size", async () => {
    mocks.readWorkArea.mockResolvedValue({
      position: { x: 0, y: 0 },
      size: { width: 580, height: 600 },
    });

    await applyOnboardingWindowSurface();

    expect(mocks.applyWindowSurfaceConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "onboarding",
        size: { width: 580, height: 600 },
        resizable: false,
        maximizable: false,
      }),
    );
  });

  it("converts a 150 percent physical work area to logical size", async () => {
    vi.mocked(windowMock.scaleFactor).mockResolvedValue(1.5);
    mocks.readWorkArea.mockResolvedValue({
      position: { x: 150, y: 90 },
      size: { width: 840, height: 900 },
    });

    await applyOnboardingWindowSurface();

    expect(mocks.applyWindowSurfaceConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        size: { width: 560, height: 600 },
      }),
    );
  });
});
