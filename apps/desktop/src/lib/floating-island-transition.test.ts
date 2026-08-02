import { describe, expect, it } from "vitest";

import {
  hasMeaningfulMorph,
  resolveCollapseMorphGeometry,
  resolveExpandMorphGeometry,
  resolveCompactRect,
  resolveExpandedRect,
  resolveIslandPlacement,
  resolveRectFlip,
  type IslandMorphGeometry,
} from "@/lib/floating-island-transition";

describe("floating island transition geometry", () => {
  it("maps a compact physical window into the expanded logical viewport", () => {
    expect(
      resolveExpandMorphGeometry({
        sourceBounds: {
          position: { x: 120, y: 80 },
          size: { width: 336, height: 68 },
        },
        targetBounds: {
          position: { x: 20, y: 0 },
          size: { width: 760, height: 1040 },
        },
        scaleFactor: 2,
      }),
    ).toEqual({
      viewport: { width: 380, height: 520 },
      from: { x: 50, y: 40, width: 168, height: 34 },
      to: { x: 0, y: 0, width: 380, height: 520 },
    });
  });

  it("maps the compact target into the current expanded viewport on collapse", () => {
    expect(
      resolveCollapseMorphGeometry({
        sourceBounds: {
          position: { x: 20, y: 0 },
          size: { width: 760, height: 1040 },
        },
        targetBounds: {
          position: { x: 232, y: 486 },
          size: { width: 336, height: 68 },
        },
        scaleFactor: 2,
      }),
    ).toEqual({
      viewport: { width: 380, height: 520 },
      from: { x: 0, y: 0, width: 380, height: 520 },
      to: { x: 106, y: 243, width: 168, height: 34 },
    });
  });

  it("ignores sub-pixel geometry noise", () => {
    expect(
      hasMeaningfulMorph({
        viewport: { width: 168, height: 34 },
        from: { x: 0, y: 0, width: 168, height: 34 },
        to: { x: 0.2, y: 0, width: 168.3, height: 34 },
      }),
    ).toBe(false);
  });

});

/**
 * Resolve o `calc` do jeito que o browser resolveria, para provar que a mesma
 * declaração cai no lugar certo antes e depois do WebView ser redimensionado.
 */
function evaluatePlacement(expression: string, viewportExtent: number): number {
  const calc = expression.match(
    /^calc\(\(100% - ([\d.-]+)px\) \* ([\d.-]+) \+ ([\d.-]+)px\)$/,
  );
  if (calc) {
    const [, anchorExtent, ratio, delta] = calc;
    return (
      (viewportExtent - Number(anchorExtent)) * Number(ratio) + Number(delta)
    );
  }

  const px = expression.match(/^([\d.-]+)px$/);
  if (!px) {
    throw new Error(`unsupported placement expression: ${expression}`);
  }
  return Number(px[1]);
}

const expandGeometry: IslandMorphGeometry = {
  viewport: { width: 380, height: 520 },
  from: { x: 106, y: 243, width: 168, height: 34 },
  to: { x: 0, y: 0, width: 380, height: 520 },
};

const collapseGeometry: IslandMorphGeometry = {
  viewport: { width: 380, height: 520 },
  from: { x: 0, y: 0, width: 380, height: 520 },
  to: { x: 106, y: 243, width: 168, height: 34 },
};

describe("resolveIslandPlacement", () => {
  it("keeps the pill on the same screen spot in both window sizes", () => {
    const pill = resolveIslandPlacement(expandGeometry.from, expandGeometry);

    // Janela ainda do tamanho da pílula: ela ocupa o viewport, menos o gutter.
    expect(evaluatePlacement(pill.left, 168)).toBe(1);
    expect(evaluatePlacement(pill.top, 34)).toBe(1);
    // Janela já expandida: mesmo ponto da tela, agora deslocado no viewport.
    expect(evaluatePlacement(pill.left, 380)).toBe(107);
    expect(evaluatePlacement(pill.top, 520)).toBe(244);
  });

  it("anchors the expanded rect where it will grow from", () => {
    const panel = resolveIslandPlacement(expandGeometry.to, expandGeometry);

    expect(evaluatePlacement(panel.left, 380)).toBe(1);
    expect(evaluatePlacement(panel.top, 520)).toBe(1);
    // Antes do resize o painel fica fora do viewport, do lado certo.
    expect(evaluatePlacement(panel.left, 168)).toBe(-105);
    expect(evaluatePlacement(panel.top, 34)).toBe(-242);
  });

  /*
   * Regressão do "piscar": no fecho a janela encolhe antes de o React voltar
   * ao estado estável. Com px puros a pílula ficava fora do viewport novo por
   * alguns frames — sumia e voltava.
   */
  it("survives the shrink at the end of a collapse", () => {
    const pill = resolveIslandPlacement(collapseGeometry.to, collapseGeometry);

    expect(evaluatePlacement(pill.left, 380)).toBe(107);
    expect(evaluatePlacement(pill.left, 168)).toBe(1);
    expect(evaluatePlacement(pill.top, 34)).toBe(1);
  });

  it("insets both rects by the gutter", () => {
    expect(resolveIslandPlacement(expandGeometry.from, expandGeometry)).toMatchObject({
      width: 166,
      height: 32,
    });
    expect(resolveIslandPlacement(expandGeometry.to, expandGeometry)).toMatchObject({
      width: 378,
      height: 518,
    });
  });
});

describe("resolveRectFlip", () => {
  it("reduces the expanded layout onto the pill", () => {
    const flip = resolveRectFlip(
      resolveCompactRect(expandGeometry),
      resolveExpandedRect(expandGeometry),
    );

    expect(flip.scaleX).toBeCloseTo(166 / 378, 6);
    expect(flip.scaleY).toBeCloseTo(32 / 518, 6);
    expect(flip.transform).toBe(
      `translate3d(106px, 243px, 0) scale(${166 / 378}, ${32 / 518})`,
    );
  });

  it("grows the pill layout onto the expanded rect", () => {
    const flip = resolveRectFlip(
      resolveExpandedRect(expandGeometry),
      resolveCompactRect(expandGeometry),
    );

    expect(flip.scaleX).toBeCloseTo(378 / 166, 6);
    expect(flip.transform).toBe(
      `translate3d(-106px, -243px, 0) scale(${378 / 166}, ${518 / 32})`,
    );
  });

  it("does not care which direction the morph runs in", () => {
    expect(
      resolveRectFlip(
        resolveCompactRect(collapseGeometry),
        resolveExpandedRect(collapseGeometry),
      ),
    ).toEqual(
      resolveRectFlip(
        resolveCompactRect(expandGeometry),
        resolveExpandedRect(expandGeometry),
      ),
    );
  });
});
