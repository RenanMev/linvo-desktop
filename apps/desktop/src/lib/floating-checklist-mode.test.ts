import { beforeEach, describe, expect, it } from "vitest";

import {
  collapseChecklistToFloating,
  expandFloatingToChecklist,
} from "@/lib/floating-checklist-mode";
import { resolveEnvelopeMorphGeometry } from "@/lib/floating-island-transition";
import { invokeMock, showMock, windowMock } from "@/test/mocks/tauri";

function regionCalls() {
  return invokeMock.mock.calls.filter((call) => call[0] === "set_window_region");
}

function boundsCalls() {
  return invokeMock.mock.calls.filter((call) => call[0] === "set_window_bounds");
}

describe("floating-checklist-mode", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    showMock.mockClear();
    windowMock.unminimize.mockClear();
    windowMock.setFocus.mockClear();
    invokeMock.mockImplementation(() => Promise.resolve(undefined));
    windowMock.scaleFactor.mockResolvedValue(1);
  });

  it("never touches window bounds: the envelope stays put for the whole morph", async () => {
    await expandFloatingToChecklist("down");
    await collapseChecklistToFloating("down");

    expect(boundsCalls()).toHaveLength(0);
  });

  it("clips to the union of compact and checklist while expanding", async () => {
    await expandFloatingToChecklist("down");

    // O checklist é mais estreito que a pílula está deslocada dentro do
    // envelope: a união é o retângulo do checklist (ver window-mode.ts).
    expect(regionCalls()).toEqual([
      [
        "set_window_region",
        {
          region: { x: 71, y: 25, width: 286, height: 418 },
          radius: 14,
        },
      ],
    ]);
  });

  it("shows, unminimizes and focuses the window before expanding", async () => {
    await expandFloatingToChecklist("down");

    expect(showMock).toHaveBeenCalled();
    expect(windowMock.unminimize).toHaveBeenCalled();
    expect(windowMock.setFocus).toHaveBeenCalled();
  });

  it("does not touch focus or visibility while collapsing", async () => {
    await collapseChecklistToFloating("down");

    expect(showMock).not.toHaveBeenCalled();
    expect(windowMock.setFocus).not.toHaveBeenCalled();
  });

  it("resolves the geometry for expand", async () => {
    const result = await expandFloatingToChecklist("down");
    expect(result).toEqual(
      resolveEnvelopeMorphGeometry({
        fromMode: "compact",
        toMode: "checklist",
        growth: "down",
      }),
    );
  });

  it("resolves the mirrored geometry for collapse", async () => {
    const result = await collapseChecklistToFloating("up");
    expect(result).toEqual(
      resolveEnvelopeMorphGeometry({
        fromMode: "checklist",
        toMode: "compact",
        growth: "up",
      }),
    );
  });
});
