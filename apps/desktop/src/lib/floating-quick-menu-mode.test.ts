import { beforeEach, describe, expect, it } from "vitest";

import {
  collapseQuickMenuToFloating,
  expandFloatingToQuickMenu,
} from "@/lib/floating-quick-menu-mode";
import { resolveEnvelopeMorphGeometry } from "@/lib/floating-island-transition";
import { invokeMock, showMock, windowMock } from "@/test/mocks/tauri";

function regionCalls() {
  return invokeMock.mock.calls.filter((call) => call[0] === "set_window_region");
}

function boundsCalls() {
  return invokeMock.mock.calls.filter((call) => call[0] === "set_window_bounds");
}

describe("floating-quick-menu-mode", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    showMock.mockClear();
    windowMock.unminimize.mockClear();
    windowMock.setFocus.mockClear();
    invokeMock.mockImplementation(() => Promise.resolve(undefined));
    windowMock.scaleFactor.mockResolvedValue(1);
  });

  it("never touches window bounds: the envelope stays put for the whole morph", async () => {
    await expandFloatingToQuickMenu("down");
    await collapseQuickMenuToFloating("down");

    expect(boundsCalls()).toHaveLength(0);
  });

  it("clips to the union of compact and quick-menu, inflated for the overshoot", async () => {
    await expandFloatingToQuickMenu("down");

    /*
     * A união das duas formas em repouso é exatamente o retângulo do
     * quick-menu (ver window-mode.test.ts) — 380x520. Sobre ela vem
     * `ISLAND_MORPH_REGION_SLACK_PX` (20px por lado, com clamp no envelope de
     * 428x568): {4,4,420,560}, que recuado pelo gutter vira o recorte abaixo.
     *
     * A folga não é decorativa: a curva de abertura passa ~3,8% do alvo antes
     * de voltar, e sem ela o recorte cortaria esse pico numa linha reta.
     */
    expect(regionCalls()).toEqual([
      [
        "set_window_region",
        {
          region: { x: 5, y: 5, width: 418, height: 558 },
          radius: 14,
        },
      ],
    ]);
  });

  it("shows, unminimizes and focuses the window before expanding", async () => {
    await expandFloatingToQuickMenu("down");

    expect(showMock).toHaveBeenCalled();
    expect(windowMock.unminimize).toHaveBeenCalled();
    expect(windowMock.setFocus).toHaveBeenCalled();
  });

  it("does not touch focus or visibility while collapsing", async () => {
    await collapseQuickMenuToFloating("down");

    expect(showMock).not.toHaveBeenCalled();
    expect(windowMock.setFocus).not.toHaveBeenCalled();
  });

  it("resolves the geometry for expand", async () => {
    const result = await expandFloatingToQuickMenu("down");
    expect(result).toEqual(
      resolveEnvelopeMorphGeometry({
        fromMode: "compact",
        toMode: "quick-menu",
        growth: "down",
      }),
    );
  });

  it("resolves the mirrored geometry for collapse", async () => {
    const result = await collapseQuickMenuToFloating("up");
    expect(result).toEqual(
      resolveEnvelopeMorphGeometry({
        fromMode: "quick-menu",
        toMode: "compact",
        growth: "up",
      }),
    );
  });
});
