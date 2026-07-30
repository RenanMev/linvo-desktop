import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { EdgeHandle } from "@/components/edge-handle";

describe("EdgeHandle", () => {
  it("renders a vertical stripe when anchored to a side", () => {
    render(
      <EdgeHandle
        anchor={{ horizontal: "right", vertical: null }}
        isActive
        onExpand={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Expandir barra/ })).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("renders a horizontal stripe when anchored to top or bottom", () => {
    render(
      <EdgeHandle
        anchor={{ horizontal: null, vertical: "bottom" }}
        isActive
        onExpand={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Expandir barra/ })).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
  });

  it("keeps the vertical fallback used by edge sizing at corners", () => {
    render(
      <EdgeHandle
        anchor={{ horizontal: "right", vertical: "bottom" }}
        isActive
        onExpand={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Expandir barra/ })).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("calls onExpand when clicked", async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(
      <EdgeHandle
        anchor={{ horizontal: "left", vertical: null }}
        isActive={false}
        onExpand={onExpand}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Expandir barra/ }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("is reachable and activatable by keyboard", async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(
      <EdgeHandle
        anchor={{ horizontal: "left", vertical: null }}
        isActive
        onExpand={onExpand}
      />,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: /Expandir barra/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("exposes a ref so the collapsed handle can be focused programmatically", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <EdgeHandle
        anchor={{ horizontal: "left", vertical: null }}
        isActive
        onExpand={vi.fn()}
        buttonRef={ref}
      />,
    );

    ref.current?.focus();
    expect(screen.getByRole("button", { name: /Expandir barra/ })).toHaveFocus();
  });
});

/**
 * O chevron aponta para longe da borda ancorada — o gesto é "puxar de volta pra
 * tela". Apontando para dentro da borda leria como "esconder mais".
 */
describe("EdgeHandle expand affordance", () => {
  const cases = [
    { edge: "left", anchor: { horizontal: "left", vertical: null }, icon: "chevron-right" },
    { edge: "right", anchor: { horizontal: "right", vertical: null }, icon: "chevron-left" },
    { edge: "top", anchor: { horizontal: null, vertical: "top" }, icon: "chevron-down" },
    { edge: "bottom", anchor: { horizontal: null, vertical: "bottom" }, icon: "chevron-up" },
  ] as const;

  for (const { edge, anchor, icon } of cases) {
    it(`points away from the ${edge} edge`, () => {
      render(<EdgeHandle anchor={anchor} isActive onExpand={vi.fn()} />);

      const svg = screen
        .getByRole("button", { name: /Expandir barra/ })
        .querySelector("svg");
      expect(svg?.getAttribute("class")).toContain(icon);
    });
  }
});
