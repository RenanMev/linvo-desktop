import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});
