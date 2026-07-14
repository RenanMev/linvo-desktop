import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders with label", () => {
    render(<Button>Enviar</Button>);

    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Enviar
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick when enabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Enviar</Button>);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
