import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  FloatingIslandShell,
  type FloatingIslandMorph,
} from "@/components/floating-island-shell";

const geometry: FloatingIslandMorph["geometry"] = {
  viewport: { width: 380, height: 520 },
  from: { x: 106, y: 243, width: 168, height: 34 },
  to: { x: 0, y: 0, width: 380, height: 520 },
};

describe("FloatingIslandShell", () => {
  it("keeps transition content inert and completes from transform transitionend", async () => {
    const onMorphComplete = vi.fn();
    const morph: FloatingIslandMorph = {
      id: 1,
      active: true,
      fromMode: "compact",
      toMode: "quick-menu",
      geometry,
    };

    const { container } = render(
      <FloatingIslandShell
        mode="quick-menu"
        morph={morph}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={onMorphComplete}
        visualWidth={168}
        growth="down"
      />,
    );

    expect(container.querySelectorAll("[inert]")).toHaveLength(2);
    expect(screen.getByTestId("floating-island-surface")).toHaveAttribute(
      "data-shape",
      "expanded",
    );

    fireEvent.transitionEnd(screen.getByTestId("floating-island-surface"), {
      propertyName: "transform",
    });

    // O commit é adiado um frame para o `SetWindowPos` do colapso não cair no
    // mesmo frame em que o CSS assenta — daí esperar em vez de checar na hora.
    await waitFor(() => expect(onMorphComplete).toHaveBeenCalledWith(1));
  });

  /*
   * Cada forma tem raio fixo e mora no próprio retângulo — animar
   * `border-radius` re-rasteriza a camada a cada frame e é o que fazia a ilha
   * sumir e voltar durante a transição inteira.
   */
  it("cross-fades two fixed-radius surfaces instead of animating the radius", () => {
    render(
      <FloatingIslandShell
        mode="compact"
        morph={{
          id: 3,
          active: false,
          fromMode: "compact",
          toMode: "quick-menu",
          geometry,
        }}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={vi.fn()}
        visualWidth={168}
        growth="down"
      />,
    );

    const pill = screen.getByTestId("floating-island-surface");
    const panel = screen.getByTestId("floating-island-surface-outgoing");
    const pillStyle = pill.getAttribute("style") ?? "";
    const panelStyle = panel.getAttribute("style") ?? "";

    expect(pill).toHaveAttribute("data-shape", "compact");
    expect(pillStyle).toContain("width: 166px");
    // O raio de repouso, o mesmo do estado parado: com a pílula desenhada
    // como retângulo arredondado ele já fica bem abaixo do limiar do
    // "barril", então não precisa mais ser reduzido durante o morph — e não
    // haver troca é o que evita o pulo de raio ao assentar.
    expect(pillStyle).toContain("border-radius: 12px");
    expect(pillStyle).toContain("translate3d(0px, 0px, 0) scale(1, 1)");
    expect(pillStyle).toContain("calc(");

    // A superfície de destino já está no lugar, encolhida sob a pílula: nenhum
    // frame do cross-fade deixa o desktop aparecer por baixo.
    expect(panel).toHaveAttribute("data-shape", "expanded");
    expect(panelStyle).toContain("width: 378px");
    expect(panelStyle).toContain("border-radius: 14px");
    expect(panelStyle).toContain(
      `translate3d(106px, 243px, 0) scale(${166 / 378}, ${32 / 518})`,
    );
    expect(panelStyle).toContain("opacity: 1");
  });

  it("only fades out the shape that is leaving", () => {
    render(
      <FloatingIslandShell
        mode="quick-menu"
        morph={{
          id: 5,
          active: true,
          fromMode: "compact",
          toMode: "quick-menu",
          geometry,
        }}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={vi.fn()}
        visualWidth={168}
        growth="down"
      />,
    );

    const panel = screen.getByTestId("floating-island-surface");
    const pill = screen.getByTestId("floating-island-surface-outgoing");

    expect(panel.getAttribute("style")).toContain("opacity: 1");
    expect(pill.getAttribute("style")).toContain("opacity: 0");
    expect(pill.getAttribute("style")).toContain(
      `translate3d(-106px, -243px, 0) scale(${378 / 166}, ${518 / 32})`,
    );
  });

  it("settles the expanded state on an untransformed layout", () => {
    render(
      <FloatingIslandShell
        mode="quick-menu"
        morph={{
          id: 4,
          active: true,
          fromMode: "compact",
          toMode: "quick-menu",
          geometry,
        }}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={vi.fn()}
        visualWidth={168}
        growth="down"
      />,
    );

    const style =
      screen.getByTestId("floating-island-surface").getAttribute("style") ?? "";

    expect(style).toContain("translate3d(0px, 0px, 0) scale(1, 1)");
    expect(style).toContain("border-radius: 14px");
  });

  it("renders one interactive layer when stable", () => {
    const { container } = render(
      <FloatingIslandShell
        mode="compact"
        morph={null}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={vi.fn()}
        visualWidth={168}
        growth="down"
      />,
    );

    expect(container.querySelectorAll(".floating-island-content")).toHaveLength(
      1,
    );
    expect(container.querySelector("[inert]")).toBeNull();
  });

  /*
   * Regressão: o envelope fixo (ver docs/SDD-ILHA-ENVELOPE.md) faz a janela
   * ter sempre 568px de altura, mesmo compacta. O estilo estável precisa
   * posicionar o conteúdo no retângulo da pílula dentro do envelope — não
   * mais confiar em `top/bottom: gutter` (que presumia janela do tamanho do
   * modo) — senão os ícones da barra ficam fora da fatia visível recortada.
   */
  it("positions the stable content and surface at the mode's own rect, not stretched to the envelope", () => {
    render(
      <FloatingIslandShell
        mode="compact"
        morph={null}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={vi.fn()}
        visualWidth={168}
        growth="down"
      />,
    );

    const surfaceStyle =
      screen.getByTestId("floating-island-surface").getAttribute("style") ?? "";
    const content = document.querySelector(
      '.floating-island-content[data-phase="stable"]',
    );
    const contentStyle = content?.getAttribute("style") ?? "";

    for (const style of [surfaceStyle, contentStyle]) {
      expect(style).toContain("left: 115px");
      expect(style).toContain("top: 25px");
      expect(style).toContain("width: 198px");
      expect(style).toContain("height: 36px");
    }
  });

  it("shifts the stable rect for the quick-menu panel, and for growth \"up\"", () => {
    const { rerender } = render(
      <FloatingIslandShell
        mode="quick-menu"
        morph={null}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={vi.fn()}
        visualWidth={380}
        growth="down"
      />,
    );

    let content = document.querySelector(
      '.floating-island-content[data-phase="stable"]',
    );
    expect(content?.getAttribute("style") ?? "").toContain("top: 25px");

    rerender(
      <FloatingIslandShell
        mode="compact"
        morph={null}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={vi.fn()}
        visualWidth={168}
        growth="up"
      />,
    );

    content = document.querySelector(
      '.floating-island-content[data-phase="stable"]',
    );
    // Crescendo para cima, a pílula encosta no fundo do envelope (568 - 24 -
    // 38 = 506), não no topo.
    expect(content?.getAttribute("style") ?? "").toContain("top: 507px");
  });

  it("finishes immediately when reduced motion is enabled", () => {
    vi.useFakeTimers();
    document.documentElement.dataset.reduceMotion = "true";
    const onMorphComplete = vi.fn();

    render(
      <FloatingIslandShell
        mode="quick-menu"
        morph={{
          id: 2,
          active: true,
          fromMode: "compact",
          toMode: "quick-menu",
          geometry,
        }}
        renderMode={(mode) => <span>{mode}</span>}
        onMorphComplete={onMorphComplete}
        visualWidth={168}
        growth="down"
      />,
    );

    act(() => vi.runAllTimers());
    expect(onMorphComplete).toHaveBeenCalledWith(2);

    delete document.documentElement.dataset.reduceMotion;
    vi.useRealTimers();
  });
});
