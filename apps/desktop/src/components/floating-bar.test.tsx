import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FloatingBar } from "@/components/floating-bar";

describe("FloatingBar", () => {
  it("renders the compact set of controls: grip, status, chat, record, collapse, minimize", () => {
    render(
      <FloatingBar
        isActive
        onOpenQuickMenu={vi.fn()}
        onCollapseToEdge={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Mover")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gravar · em breve" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Encolher" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimizar" })).toBeInTheDocument();
  });

  it("does not render a standalone 'Mais' button", () => {
    render(
      <FloatingBar
        isActive
        onOpenQuickMenu={vi.fn()}
        onCollapseToEdge={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Mais" })).not.toBeInTheDocument();
  });

  it("calls onOpenQuickMenu when Chat is clicked", async () => {
    const user = userEvent.setup();
    const onOpenQuickMenu = vi.fn();
    render(
      <FloatingBar
        isActive
        onOpenQuickMenu={onOpenQuickMenu}
        onCollapseToEdge={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Chat" }));
    expect(onOpenQuickMenu).toHaveBeenCalledTimes(1);
  });

  it("calls onCollapseToEdge when Encolher is clicked", async () => {
    const user = userEvent.setup();
    const onCollapseToEdge = vi.fn();
    render(
      <FloatingBar
        isActive
        onOpenQuickMenu={vi.fn()}
        onCollapseToEdge={onCollapseToEdge}
        onMinimize={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Encolher" }));
    expect(onCollapseToEdge).toHaveBeenCalledTimes(1);
  });

  it("calls onMinimize when Minimizar is clicked", async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    render(
      <FloatingBar
        isActive
        onOpenQuickMenu={vi.fn()}
        onCollapseToEdge={vi.fn()}
        onMinimize={onMinimize}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });
});
