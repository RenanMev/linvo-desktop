import { describe, expect, it } from "vitest";

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
    expect(isAllowedManualDownloadUrl("http://github.com/RenanMev/linvo-desktop/releases/latest")).toBe(
      false,
    );
    expect(
      isAllowedManualDownloadUrl("https://evil.example/RenanMev/linvo-desktop/releases/latest"),
    ).toBe(false);
    expect(
      isAllowedManualDownloadUrl("https://github.com/other/repo/releases/latest"),
    ).toBe(false);
  });
});
