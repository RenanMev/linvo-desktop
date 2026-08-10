import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  StepActions,
  StepHeader,
  StepLink,
  StepPrimary,
} from "@/components/onboarding/step-shell";

describe("StepHeader", () => {
  it("renders the step title as the heading", () => {
    render(
      <StepHeader
        title="Escolha seu workspace"
        description="Ele reúne o contexto do assistente."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Escolha seu workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ele reúne o contexto do assistente."),
    ).toBeInTheDocument();
  });
});

describe("StepActions", () => {
  it("keeps the primary action before the discreet links", () => {
    render(
      <StepActions links={<StepLink>Pular por agora</StepLink>}>
        <StepPrimary>Continuar</StepPrimary>
      </StepActions>,
    );

    const primary = screen.getByRole("button", { name: "Continuar" });
    const link = screen.getByRole("button", { name: "Pular por agora" });

    expect(
      primary.compareDocumentPosition(link) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders without links", () => {
    render(
      <StepActions>
        <StepPrimary>Continuar</StepPrimary>
      </StepActions>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
