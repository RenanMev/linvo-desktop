import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/context/appearance-context", () => ({
  useAppearance: () => ({
    preferences: {
      themeMode: "dark",
      accentColor: "green",
    },
  }),
}));

import { OnboardingPreview } from "@/components/onboarding/onboarding-preview";

describe("OnboardingPreview", () => {
  it("shows the live workspace name and image", () => {
    render(
      <OnboardingPreview
        stepId="workspace"
        workspaceName="Atendimento"
        imagePreviewUrl="blob:workspace"
      />,
    );

    expect(screen.getByText("Atendimento")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:workspace");
  });

  it("truncates a long workspace name", () => {
    const longName = "A".repeat(80);
    render(
      <OnboardingPreview
        stepId="context"
        workspaceName={longName}
        imagePreviewUrl={null}
      />,
    );

    expect(screen.getByText(longName)).toHaveClass("truncate");
  });

  it("shows the active theme and accent in appearance mode", () => {
    render(
      <OnboardingPreview
        stepId="appearance"
        workspaceName=""
        imagePreviewUrl={null}
      />,
    );

    expect(screen.getByText("dark · green")).toBeInTheDocument();
    expect(screen.getByTestId("appearance-preview")).toBeInTheDocument();
  });

  it("shows support content for tour and question steps", () => {
    const { rerender } = render(
      <OnboardingPreview
        stepId="bar_tour"
        workspaceName=""
        imagePreviewUrl={null}
      />,
    );
    expect(screen.getByText("A barra acompanha você")).toBeInTheDocument();

    rerender(
      <OnboardingPreview
        stepId="first_question"
        workspaceName=""
        imagePreviewUrl={null}
      />,
    );
    expect(screen.getByText("Seu primeiro resultado real")).toBeInTheDocument();
  });
});
