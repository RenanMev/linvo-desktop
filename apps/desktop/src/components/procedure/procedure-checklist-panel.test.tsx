import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProcedureChecklistPanel } from "@/components/procedure/procedure-checklist-panel";

function EphemeralHarness() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Reabrir
      </button>
    );
  }

  return (
    <ProcedureChecklistPanel
      title="Número cancelado"
      slug="numero_cancelado"
      steps={["Validar pagamento", "Reativar linha"]}
      onClose={() => setOpen(false)}
    />
  );
}

describe("ProcedureChecklistPanel", () => {
  it("opens with checkboxes derived from steps", () => {
    render(
      <ProcedureChecklistPanel
        title="Número cancelado"
        slug="numero_cancelado"
        steps={["Validar pagamento", "Reativar linha"]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Número cancelado")).toBeInTheDocument();
    expect(screen.getByText("/numero_cancelado")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Validar pagamento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Reativar linha" }),
    ).toBeInTheDocument();
  });

  it("toggles checkbox state locally", async () => {
    const user = userEvent.setup();
    render(
      <ProcedureChecklistPanel
        title="Número cancelado"
        slug="numero_cancelado"
        steps={["Validar pagamento", "Reativar linha"]}
        onClose={vi.fn()}
      />,
    );

    const first = screen.getByRole("checkbox", { name: "Validar pagamento" });
    expect(first).toHaveAttribute("aria-checked", "false");

    await user.click(first);
    expect(first).toHaveAttribute("aria-checked", "true");

    await user.click(first);
    expect(first).toHaveAttribute("aria-checked", "false");
  });

  it("discards checkbox state when panel is closed and reopened", async () => {
    const user = userEvent.setup();
    render(<EphemeralHarness />);

    const first = screen.getByRole("checkbox", { name: "Validar pagamento" });
    await user.click(first);
    expect(first).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: /fechar/i }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reabrir/i }));

    expect(
      screen.getByRole("checkbox", { name: "Validar pagamento" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("checkbox", { name: "Reativar linha" }),
    ).toHaveAttribute("aria-checked", "false");
  });
});
