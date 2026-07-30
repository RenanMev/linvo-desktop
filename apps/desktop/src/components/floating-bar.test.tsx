import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FloatingBar } from "@/components/floating-bar";

type Overrides = Partial<React.ComponentProps<typeof FloatingBar>>;

function renderBar(overrides: Overrides = {}) {
  const props = {
    isActive: true,
    onOpenQuickMenu: vi.fn(),
    onCollapseToEdge: vi.fn(),
    onMinimize: vi.fn(),
    onResetPosition: vi.fn(),
    ...overrides,
  };
  render(<FloatingBar {...props} />);
  return props;
}

describe("FloatingBar", () => {
  it("renders the compact set of controls: grip, status, chat, record, collapse, minimize", () => {
    renderBar();

    expect(screen.getByTitle(/^Mover/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gravar · em breve" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Encolher" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimizar" })).toBeInTheDocument();
  });

  it("does not render a standalone 'Mais' button", () => {
    renderBar();

    expect(screen.queryByRole("button", { name: "Mais" })).not.toBeInTheDocument();
  });

  it("calls onOpenQuickMenu when Chat is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenQuickMenu } = renderBar();

    await user.click(screen.getByRole("button", { name: "Chat" }));
    expect(onOpenQuickMenu).toHaveBeenCalledTimes(1);
  });

  it("shows the chat shortcuts popover content", () => {
    renderBar();

    expect(screen.getByText("Atalhos")).toBeInTheDocument();
    expect(screen.getByText("Ctrl Shift L")).toBeInTheDocument();
    expect(screen.getByText("Abrir chat")).toBeInTheDocument();
  });

  it("calls onCollapseToEdge when Encolher is clicked", async () => {
    const user = userEvent.setup();
    const { onCollapseToEdge } = renderBar();

    await user.click(screen.getByRole("button", { name: "Encolher" }));
    expect(onCollapseToEdge).toHaveBeenCalledTimes(1);
  });

  it("calls onMinimize when Minimizar is clicked", async () => {
    const user = userEvent.setup();
    const { onMinimize } = renderBar();

    await user.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });
});

describe("FloatingBar position reset gesture", () => {
  const documentListener = vi.fn();

  afterEach(() => {
    document.removeEventListener("mousedown", documentListener);
    documentListener.mockReset();
  });

  it("resets the position on ctrl+shift+click of the grip", () => {
    const { onResetPosition } = renderBar();

    fireEvent.mouseDown(screen.getByTitle(/^Mover/), {
      button: 0,
      ctrlKey: true,
      shiftKey: true,
    });

    expect(onResetPosition).toHaveBeenCalledTimes(1);
  });

  it("stops propagation so the Tauri drag handler never starts a drag", () => {
    // O Tauri escuta `mousedown` no document para iniciar o arraste.
    document.addEventListener("mousedown", documentListener);
    renderBar();

    fireEvent.mouseDown(screen.getByTitle(/^Mover/), {
      button: 0,
      ctrlKey: true,
      shiftKey: true,
    });

    expect(documentListener).not.toHaveBeenCalled();
  });

  it("leaves a plain drag on the grip untouched", () => {
    document.addEventListener("mousedown", documentListener);
    const { onResetPosition } = renderBar();

    fireEvent.mouseDown(screen.getByTitle(/^Mover/), { button: 0 });

    expect(onResetPosition).not.toHaveBeenCalled();
    // Propagação intacta: o arraste normal continua funcionando.
    expect(documentListener).toHaveBeenCalledTimes(1);
  });

  it("ignores the gesture when only one modifier is held", () => {
    const { onResetPosition } = renderBar();
    const grip = screen.getByTitle(/^Mover/);

    fireEvent.mouseDown(grip, { button: 0, ctrlKey: true });
    fireEvent.mouseDown(grip, { button: 0, shiftKey: true });

    expect(onResetPosition).not.toHaveBeenCalled();
  });

  it("ignores ctrl+shift with a non-primary button", () => {
    const { onResetPosition } = renderBar();

    fireEvent.mouseDown(screen.getByTitle(/^Mover/), {
      button: 2,
      ctrlKey: true,
      shiftKey: true,
    });

    expect(onResetPosition).not.toHaveBeenCalled();
  });
});
