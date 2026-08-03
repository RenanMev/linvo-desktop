import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ContextStep } from "@/components/onboarding/steps/context-step";
import type { OnboardingRule } from "@/hooks/use-onboarding-flow";

function makeRule(
  id: string,
  status: OnboardingRule["status"] = "draft",
): OnboardingRule {
  return {
    id,
    title: `Regra ${id}`,
    content: `Conteúdo ${id}`,
    status,
  };
}

function renderStep(
  overrides: Partial<React.ComponentProps<typeof ContextStep>> = {},
) {
  const props: React.ComponentProps<typeof ContextStep> = {
    rules: [],
    busy: false,
    error: null,
    onAddRule: vi.fn(),
    onUpdateRule: vi.fn(),
    onRemoveRule: vi.fn(),
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
  render(<ContextStep {...props} />);
  return props;
}

describe("ContextStep", () => {
  it("adds editable preset rules without saving immediately", async () => {
    const pointer = userEvent.setup();
    const props = renderStep();

    await pointer.click(
      screen.getByRole("button", { name: "Tom de atendimento" }),
    );

    expect(props.onAddRule).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tom de atendimento" }),
    );
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("renders multiple rules and removes an item", async () => {
    const pointer = userEvent.setup();
    const props = renderStep({
      rules: [makeRule("1"), makeRule("2")],
    });

    expect(screen.getAllByLabelText(/Título da regra/)).toHaveLength(2);
    await pointer.click(screen.getAllByTitle("Remover regra")[0]);
    expect(props.onRemoveRule).toHaveBeenCalledWith("1");
  });

  it("keeps only failed rules visible after a partial save", () => {
    renderStep({
      rules: [makeRule("1", "saved"), makeRule("2", "error")],
      error: "1 regra falhou ao salvar",
    });

    expect(screen.queryByDisplayValue("Regra 1")).toBeNull();
    expect(screen.getByDisplayValue("Regra 2")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 regra falhou ao salvar",
    );
  });

  it("skips without confirming rules", async () => {
    const pointer = userEvent.setup();
    const props = renderStep({ rules: [makeRule("1")] });

    await pointer.click(
      screen.getByRole("button", { name: "Pular por agora" }),
    );

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
