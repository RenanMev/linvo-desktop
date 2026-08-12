import { describe, expect, it } from "vitest";

import { resolveCloseAction } from "@/lib/window-close";

describe("resolveCloseAction", () => {
  it("closes panel window", () => {
    expect(
      resolveCloseAction({ windowLabel: "panel", authPhase: "floating" }),
    ).toBe("close-panel");
  });

  it("closes checklist window", () => {
    expect(
      resolveCloseAction({ windowLabel: "checklist", authPhase: "floating" }),
    ).toBe("close-checklist");
  });

  it("closes capture overlay window", () => {
    expect(
      resolveCloseAction({
        windowLabel: "capture-overlay",
        authPhase: "floating",
      }),
    ).toBe("close-overlay");
  });

  it("hides main window in auth phases", () => {
    expect(
      resolveCloseAction({ windowLabel: "main", authPhase: "checking" }),
    ).toBe("hide");
    expect(
      resolveCloseAction({ windowLabel: "main", authPhase: "unauthenticated" }),
    ).toBe("hide");
  });

  it("hides main window in floating phase", () => {
    expect(
      resolveCloseAction({ windowLabel: "main", authPhase: "floating" }),
    ).toBe("hide");
  });
});
