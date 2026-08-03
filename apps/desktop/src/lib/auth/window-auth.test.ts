import { describe, expect, it } from "vitest";

import {
  AUTH_SIZE,
  configForSurfaceMode,
  surfaceModeForAuthPhase,
} from "@/lib/auth/window-auth";
import { ONBOARDING_SIZE } from "@/lib/window-mode";

describe("configForSurfaceMode", () => {
  it("configures auth window as decorated and visible in taskbar", () => {
    const config = configForSurfaceMode("auth");

    expect(config.size).toEqual(AUTH_SIZE);
    expect(config.decorations).toBe(false);
    expect(config.alwaysOnTop).toBe(false);
    expect(config.skipTaskbar).toBe(false);
    expect(config.maximizable).toBe(false);
    expect(config.transparent).toBe(true);
  });

  it("configures compact window as floating shell", () => {
    const config = configForSurfaceMode("compact");

    expect(config.decorations).toBe(false);
    expect(config.alwaysOnTop).toBe(true);
    expect(config.skipTaskbar).toBe(true);
    expect(config.maximizable).toBe(false);
    expect(config.transparent).toBe(true);
  });

  it("configures onboarding as a fixed centered surface", () => {
    const config = configForSurfaceMode("onboarding");

    expect(config.size).toEqual(ONBOARDING_SIZE);
    expect(config.decorations).toBe(false);
    expect(config.alwaysOnTop).toBe(false);
    expect(config.skipTaskbar).toBe(false);
    expect(config.resizable).toBe(false);
    expect(config.maximizable).toBe(false);
    expect(config.transparent).toBe(true);
  });
});

describe("surfaceModeForAuthPhase", () => {
  it("uses auth surface before floating", () => {
    expect(surfaceModeForAuthPhase("checking")).toBe("auth");
    expect(surfaceModeForAuthPhase("unauthenticated")).toBe("auth");
  });

  it("uses compact surface when floating", () => {
    expect(surfaceModeForAuthPhase("floating")).toBe("compact");
  });

  it("uses onboarding surface during onboarding", () => {
    expect(surfaceModeForAuthPhase("onboarding")).toBe("onboarding");
  });
});
