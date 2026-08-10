import type { ReactElement } from "react";
import type { UserPublic } from "@linvo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hideAllWindows: vi.fn(),
  controller: {
    stepId: "welcome",
    steps: [
      { id: "welcome", status: "current" },
      { id: "workspace", status: "pending" },
      { id: "context", status: "pending" },
      { id: "knowledge", status: "pending" },
      { id: "appearance", status: "pending" },
      { id: "bar_tour", status: "pending" },
      { id: "first_question", status: "pending" },
    ],
    processingStepIds: new Set(),
    goTo: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    busy: false,
    error: null,
    setError: vi.fn(),
    workspaces: [],
    activeWorkspace: null,
    workspaceName: "",
    setWorkspaceName: vi.fn(),
    activeWorkspaceId: null,
    selectWorkspace: vi.fn(),
    createdWorkspaceId: null,
    imageFile: null,
    imagePreviewUrl: null,
    setImageFile: vi.fn(),
    confirmWorkspace: vi.fn(),
    rules: [],
    addRule: vi.fn(),
    updateRule: vi.fn(),
    removeRule: vi.fn(),
    confirmContext: vi.fn(),
    ruleDiscovery: {
      session: null,
      start: vi.fn(),
      refresh: vi.fn(),
      isPolling: false,
      error: null,
    },
    knowledgeIntent: null,
    setKnowledgeIntent: vi.fn(),
    confirmKnowledge: vi.fn(),
    finish: vi.fn(),
  },
}));

vi.mock("@/hooks/use-onboarding-flow", () => ({
  useOnboardingFlow: () => mocks.controller,
}));

vi.mock("@/hooks/use-onboarding-bar-tour", () => ({
  useOnboardingBarTour: () => ({
    shortcutDone: false,
    dragDone: false,
    shortcutUnavailable: false,
  }),
}));

vi.mock("@/hooks/use-quick-prompt", () => ({
  useQuickPrompt: () => ({
    status: "idle",
    responseText: "",
    errorMessage: null,
    conversationId: null,
    isThinking: false,
    send: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/context/appearance-context", () => ({
  useAppearance: () => ({
    preferences: {
      themeMode: "dark",
      accentColor: "purple",
    },
    setPreference: vi.fn(),
  }),
}));

vi.mock("@/lib/onboarding/onboarding-store", () => ({
  isOnboardingForced: () => false,
}));

vi.mock("@/lib/app-windows", () => ({
  hideAllWindows: mocks.hideAllWindows,
}));

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

const user = {
  id: "user-1",
  name: "Renan Silva",
  email: "renan@example.com",
} as UserPublic;

function renderShell(): {
  rerender: (ui: ReactElement) => void;
} {
  return render(
    <OnboardingShell user={user} onComplete={vi.fn()} />,
  );
}

describe("OnboardingShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.controller.stepId = "welcome";
    mocks.controller.steps = [
      { id: "welcome", status: "current" },
      { id: "workspace", status: "pending" },
      { id: "context", status: "pending" },
      { id: "knowledge", status: "pending" },
      { id: "appearance", status: "pending" },
      { id: "bar_tour", status: "pending" },
      { id: "first_question", status: "pending" },
    ];
    mocks.controller.busy = false;
    mocks.controller.workspaceName = "";
    mocks.controller.activeWorkspaceId = null;
  });

  it("uses Enter for the primary action but not inside a textarea", () => {
    const { rerender } = renderShell();

    fireEvent.keyDown(screen.getByTestId("onboarding-shell"), {
      key: "Enter",
    });
    expect(mocks.controller.next).toHaveBeenCalledTimes(1);

    mocks.controller.stepId = "first_question";
    rerender(<OnboardingShell user={user} onComplete={vi.fn()} />);
    fireEvent.keyDown(screen.getByLabelText("Sua primeira pergunta"), {
      key: "Enter",
    });

    expect(mocks.controller.finish).not.toHaveBeenCalled();
  });

  it("keeps Escape passive and blocks primary actions while busy", () => {
    mocks.controller.busy = true;
    renderShell();

    fireEvent.keyDown(screen.getByTestId("onboarding-shell"), {
      key: "Escape",
    });
    fireEvent.keyDown(screen.getByTestId("onboarding-shell"), {
      key: "Enter",
    });

    expect(mocks.hideAllWindows).not.toHaveBeenCalled();
    expect(mocks.controller.next).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Aguarde..." }),
    ).toBeDisabled();
  });

  it("renders each of the seven steps", () => {
    const { rerender } = renderShell();
    const expectations = [
      ["welcome", "Prepare o Linvo para trabalhar com você"],
      ["workspace", "Escolha seu workspace"],
      ["context", "Adicione contexto inicial"],
      ["knowledge", "Traga conhecimento para o workspace"],
      ["appearance", "Deixe o Linvo com a sua cara"],
      ["bar_tour", "Experimente a barra flutuante"],
      ["first_question", "Faça sua primeira pergunta real"],
    ] as const;

    for (const [stepId, heading] of expectations) {
      mocks.controller.stepId = stepId;
      rerender(<OnboardingShell user={user} onComplete={vi.fn()} />);
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
  });

  it("shows the position in the flow for the current step", () => {
    mocks.controller.stepId = "appearance";
    renderShell();

    expect(screen.getByText("Etapa 5 de 7")).toBeInTheDocument();
  });

  it("goes back from any step after the first", () => {
    mocks.controller.stepId = "workspace";
    const { rerender } = renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(mocks.controller.back).toHaveBeenCalledTimes(1);

    mocks.controller.stepId = "welcome";
    rerender(<OnboardingShell user={user} onComplete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
  });

  it("keeps tab order from content to the titlebar actions", () => {
    mocks.controller.stepId = "workspace";
    renderShell();

    const contentField = screen.getByLabelText("Nome do workspace");
    const titlebarAction = screen.getByTitle("Minimizar");

    expect(
      contentField.compareDocumentPosition(titlebarAction) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
