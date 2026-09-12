import { beforeEach, describe, expect, it } from "vitest";

import {
  collapseToEdge,
  edgeHandleSize,
  expandFromEdge,
  resolveEdgeHandleBounds,
  resolveNearestAnchor,
} from "@/lib/floating-edge-mode";
import {
  EDGE_HANDLE_LENGTH,
  EDGE_HANDLE_THICKNESS,
  ISLAND_ENVELOPE_SIZE,
  pillPositionForEnvelope,
} from "@/lib/window-mode";
import { loadIslandPillPosition } from "@/lib/window-storage";
import {
  invokeMock,
  setPositionMock,
  setSizeMock,
  windowMock,
} from "@/test/mocks/tauri";
import type { MonitorInfo } from "@/lib/window-position";

const workArea: MonitorInfo = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1040 },
};

// Derivado das constantes de propósito: a espessura/comprimento são valores de
// ajuste, e fixá-los aqui só faria o teste quebrar a cada tuning.
const stripeAcross = { width: EDGE_HANDLE_THICKNESS, height: EDGE_HANDLE_LENGTH };
const stripeAlong = { width: EDGE_HANDLE_LENGTH, height: EDGE_HANDLE_THICKNESS };

describe("edgeHandleSize", () => {
  it("is a vertical stripe when anchored to a side", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: null })).toEqual(
      stripeAcross,
    );
    expect(edgeHandleSize({ horizontal: "right", vertical: null })).toEqual(
      stripeAcross,
    );
  });

  it("is a horizontal stripe when anchored to top or bottom", () => {
    expect(edgeHandleSize({ horizontal: null, vertical: "top" })).toEqual(
      stripeAlong,
    );
    expect(edgeHandleSize({ horizontal: null, vertical: "bottom" })).toEqual(
      stripeAlong,
    );
  });

  it("falls back to a vertical stripe for a corner or no anchor", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: "top" })).toEqual(
      stripeAcross,
    );
    expect(edgeHandleSize({ horizontal: null, vertical: null })).toEqual(
      stripeAcross,
    );
  });

  it("never exceeds 16px on the perpendicular axis", () => {
    expect(edgeHandleSize({ horizontal: "left", vertical: null }).width).toBeLessThanOrEqual(16);
    expect(edgeHandleSize({ horizontal: null, vertical: "top" }).height).toBeLessThanOrEqual(16);
  });
});

describe("resolveEdgeHandleBounds", () => {
  it("hugs the left edge, keeping the vertical coordinate", () => {
    const position = resolveEdgeHandleBounds({
      anchor: { horizontal: "left", vertical: null },
      size: { width: 12, height: 64 },
      workArea,
      previousPosition: { x: 500, y: 300 },
    });
    expect(position).toEqual({ x: 0, y: 300 });
  });

  it("hugs the bottom edge, keeping the horizontal coordinate", () => {
    const position = resolveEdgeHandleBounds({
      anchor: { horizontal: null, vertical: "bottom" },
      size: { width: 64, height: 12 },
      workArea,
      previousPosition: { x: 700, y: 300 },
    });
    expect(position).toEqual({ x: 700, y: 1040 - 12 });
  });
});

describe("resolveNearestAnchor", () => {
  it("anchors to exactly the closest edge regardless of distance", () => {
    const anchor = resolveNearestAnchor({
      position: { x: 900, y: 500 },
      size: { width: 168, height: 34 },
      workArea,
    });
    expect(anchor).toEqual({ horizontal: null, vertical: "top" });
  });

  it("picks the closest axis instead of forcing a corner", () => {
    const anchor = resolveNearestAnchor({
      position: { x: 100, y: 60 },
      size: { width: 168, height: 34 },
      workArea,
    });
    expect(anchor).toEqual({ horizontal: null, vertical: "top" });
  });
});

describe("collapseToEdge / expandFromEdge (envelope native transitions)", () => {
  const nativeWorkArea = { x: 0, y: 0, width: 1920, height: 1080 };

  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    setPositionMock.mockClear();
    setSizeMock.mockClear();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "monitor_work_area") {
        return Promise.resolve(nativeWorkArea);
      }
      return Promise.resolve(undefined);
    });
    windowMock.scaleFactor.mockResolvedValue(1);
  });

  function regionCalls() {
    return invokeMock.mock.calls.filter((call) => call[0] === "set_window_region");
  }

  it("clips to the handle's own bounds, not the envelope's — the window IS the handle now", async () => {
    windowMock.outerPosition.mockResolvedValue({ x: 270, y: 176 });
    windowMock.outerSize.mockResolvedValue(ISLAND_ENVELOPE_SIZE);

    const anchor = await collapseToEdge("down");

    // A pílula estava perto do topo (176px de folga acima vs. 846px abaixo):
    // ancora no topo, handle horizontal (112x12).
    expect(anchor).toEqual({ horizontal: null, vertical: "top" });
    expect(regionCalls()).toEqual([
      ["set_window_region", { region: { x: 1, y: 1, width: 110, height: 10 }, radius: 0 }],
    ]);
  });

  it("round-trips the pill's screen position through collapse and expand", async () => {
    const envelopePosition = { x: 270, y: 176 };
    windowMock.outerPosition.mockResolvedValue(envelopePosition);
    windowMock.outerSize.mockResolvedValue(ISLAND_ENVELOPE_SIZE);

    const pillBefore = pillPositionForEnvelope({ envelopePosition, growth: "down" });

    const anchor = await collapseToEdge("down");
    expect(anchor).not.toBeNull();

    // Simula o SetWindowPos que a animação nativa teria aplicado: a janela
    // real agora tem os bounds da última chamada de fallback setSize/setPosition.
    const positionCalls = setPositionMock.mock.calls as unknown as Array<
      [{ x: number; y: number }]
    >;
    const sizeCalls = setSizeMock.mock.calls as unknown as Array<
      [{ width: number; height: number }]
    >;
    const handlePosition = positionCalls[positionCalls.length - 1][0];
    const handleSize = sizeCalls[sizeCalls.length - 1][0];
    windowMock.outerPosition.mockResolvedValue({ x: handlePosition.x, y: handlePosition.y });
    windowMock.outerSize.mockResolvedValue({
      width: handleSize.width,
      height: handleSize.height,
    });

    const resolvedGrowth = await expandFromEdge();

    // A pílula volta perto do topo, com espaço de sobra abaixo: recalcula
    // para "down" de novo, mesmo que a sessão nunca tivesse passado isso.
    expect(resolvedGrowth).toBe("down");
    expect(loadIslandPillPosition()).toEqual(pillBefore);
  });
});
