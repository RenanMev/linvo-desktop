import { describe, expect, it } from "vitest";

import {
  hasMeaningfulMorph,
  ISLAND_GUTTER_PX,
  ISLAND_MORPH_COMPACT_RADIUS_PX,
  resolveEnvelopeMorphGeometry,
  resolveCompactRect,
  resolveExpandedRect,
  resolveIslandPlacement,
  resolveRectFlip,
  type IslandMorphGeometry,
} from "@/lib/floating-island-transition";
import {
  COMPACT_SIZE,
  ISLAND_ENVELOPE_SIZE,
  islandRectForMode,
  radiusForEnvelopeMode,
} from "@/lib/window-mode";

describe("floating island transition geometry", () => {
  it("uses the envelope as a fixed viewport for both rects", () => {
    const geometry = resolveEnvelopeMorphGeometry({
      fromMode: "compact",
      toMode: "quick-menu",
      growth: "down",
    });

    expect(geometry).toEqual({
      viewport: ISLAND_ENVELOPE_SIZE,
      from: islandRectForMode("compact", "down"),
      to: islandRectForMode("quick-menu", "down"),
    });
  });

  it("does not depend on transition direction: expand and collapse are the same rects reversed", () => {
    const expand = resolveEnvelopeMorphGeometry({
      fromMode: "compact",
      toMode: "checklist",
      growth: "up",
    });
    const collapse = resolveEnvelopeMorphGeometry({
      fromMode: "checklist",
      toMode: "compact",
      growth: "up",
    });

    expect(collapse.from).toEqual(expand.to);
    expect(collapse.to).toEqual(expand.from);
    expect(collapse.viewport).toEqual(expand.viewport);
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

/**
 * Regressão: `resolveRectFlip` anima a camada da pílula via `transform:
 * scale()`, que estica `border-radius` pelos mesmos fatores não uniformes do
 * resto da forma. Com o raio de repouso (height/2) o alcance vertical do
 * arco bate exatamente na metade da altura do alvo no pior caso — os arcos
 * do topo e do fundo se encontram no meio, e a pílula vira um "barril"
 * (cintura fina, topo/base estufados) em vez de manter os cantos retos.
 * `ISLAND_MORPH_COMPACT_RADIUS_PX` precisa deixar uma margem folgada disso
 * em todo alvo real (quick-menu e checklist), nas duas direções de
 * crescimento.
 */
describe("ISLAND_MORPH_COMPACT_RADIUS_PX safety margin", () => {
  const targets = ["quick-menu", "checklist"] as const;
  const growths = ["down", "up"] as const;

  for (const toMode of targets) {
    for (const growth of growths) {
      it(`stays well below the barrel threshold for compact -> ${toMode} (growth: ${growth})`, () => {
        const geometry = resolveEnvelopeMorphGeometry({
          fromMode: "compact",
          toMode,
          growth,
        });
        const compactRect = resolveCompactRect(geometry);
        const expandedRect = resolveExpandedRect(geometry);
        const expandedPlacement = resolveIslandPlacement(expandedRect, geometry);
        const flip = resolveRectFlip(expandedRect, compactRect);

        const effectiveVerticalReach = ISLAND_MORPH_COMPACT_RADIUS_PX * flip.scaleY;
        const halfTargetHeight = expandedPlacement.height / 2;

        // O "barril" aparece quando o alcance chega a 100% da metade da
        // altura (os dois arcos se tocam). 75% ainda deixa um quarto da
        // metade da altura em lado reto.
        expect(effectiveVerticalReach).toBeLessThanOrEqual(halfTargetHeight * 0.75);
      });
    }
  }

  /*
   * A razão do barril é `raio / (altura interna da pílula / 2)` e NÃO depende
   * do alvo: o alcance do arco e a altura da camada são ambos multiplicados
   * por `scaleY`, então o fator se cancela. Os casos por alvo acima confirmam
   * isso; este teste guarda o limite de verdade, que é só sobre a pílula.
   *
   * É a forma acionável do invariante: se alguém aumentar o raio ou diminuir
   * a altura da pílula, é aqui que a conta estoura, com o número certo à mão.
   */
  it("keeps the morph radius below half the pill's own inner height", () => {
    const compactInnerHalf = (COMPACT_SIZE.height - ISLAND_GUTTER_PX * 2) / 2;
    expect(ISLAND_MORPH_COMPACT_RADIUS_PX).toBeLessThan(compactInnerHalf);
  });

  it("uses the resting radius, so nothing pops when the morph settles", () => {
    expect(ISLAND_MORPH_COMPACT_RADIUS_PX).toBe(radiusForEnvelopeMode("compact"));
  });
});
