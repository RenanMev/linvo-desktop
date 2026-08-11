import { describe, expect, it } from "vitest";

import {
  compareSemver,
  desktopReleaseResponseSchema,
  isVersionBelow,
} from "./desktop-release";

describe("desktopReleaseResponseSchema", () => {
  it("accepts a valid release payload", () => {
    const result = desktopReleaseResponseSchema.safeParse({
      latestVersion: "0.2.0",
      minSupportedVersion: "0.1.0",
      releaseNotes: "Correções e melhorias.",
      publishedAt: "2026-08-11T12:00:00.000Z",
      downloadUrl: "https://github.com/RenanMev/linvo-desktop/releases/latest",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid semver", () => {
    expect(
      desktopReleaseResponseSchema.safeParse({
        latestVersion: "v0.2.0",
        minSupportedVersion: "0.1.0",
        releaseNotes: "x",
        publishedAt: "2026-08-11T12:00:00.000Z",
        downloadUrl: "https://example.com",
      }).success,
    ).toBe(false);
  });
});

describe("compareSemver", () => {
  it("orders versions", () => {
    expect(compareSemver("0.1.0", "0.1.1")).toBe(-1);
    expect(compareSemver("0.2.0", "0.1.9")).toBe(1);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
  });
});

describe("isVersionBelow", () => {
  it("detects outdated clients", () => {
    expect(isVersionBelow("0.1.0", "0.1.1")).toBe(true);
    expect(isVersionBelow("0.1.1", "0.1.1")).toBe(false);
    expect(isVersionBelow("0.2.0", "0.1.1")).toBe(false);
  });
});
