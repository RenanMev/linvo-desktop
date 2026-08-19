import { act, fireEvent, render, screen } from "@testing-library/react";
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
  it("keeps transition content inert and completes from transform transitionend", () => {
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
    expect(onMorphComplete).toHaveBeenCalledWith(1);
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
      />,
    );

    const pill = screen.getByTestId("floating-island-surface");
    const panel = screen.getByTestId("floating-island-surface-outgoing");
    const pillStyle = pill.getAttribute("style") ?? "";
    const panelStyle = panel.getAttribute("style") ?? "";

    expect(pill).toHaveAttribute("data-shape", "compact");
    expect(pillStyle).toContain("width: 166px");
    expect(pillStyle).toContain("border-radius: 16px");
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
      />,
    );

    expect(container.querySelectorAll(".floating-island-content")).toHaveLength(
      1,
    );
    expect(container.querySelector("[inert]")).toBeNull();
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
      />,
    );

    act(() => vi.runAllTimers());
    expect(onMorphComplete).toHaveBeenCalledWith(2);

    delete document.documentElement.dataset.reduceMotion;
    vi.useRealTimers();
  });
});
