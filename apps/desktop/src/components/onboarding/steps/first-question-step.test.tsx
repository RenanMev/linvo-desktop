import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prompt: {
    status: "idle" as "idle" | "streaming" | "done" | "error",
    responseText: "",
    errorMessage: null as string | null,
    conversationId: null as string | null,
    isThinking: false,
    send: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("@/hooks/use-quick-prompt", () => ({
  useQuickPrompt: () => mocks.prompt,
}));

import { FirstQuestionStep } from "@/components/onboarding/steps/first-question-step";

describe("FirstQuestionStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prompt.status = "idle";
    mocks.prompt.responseText = "";
    mocks.prompt.errorMessage = null;
    mocks.prompt.conversationId = null;
    mocks.prompt.isThinking = false;
    mocks.prompt.send.mockResolvedValue(true);
  });

  it("sends a real question and includes the workspace in suggestions", async () => {
    const pointer = userEvent.setup();
    render(
      <FirstQuestionStep
        workspaceName="Atendimento"
        busy={false}
        finish={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Resuma as regras de Atendimento",
      }),
    ).toBeInTheDocument();
    await pointer.type(
      screen.getByLabelText("Sua primeira pergunta"),
      "Resuma as regras",
    );
    await pointer.click(screen.getByRole("button", { name: "Enviar" }));

    expect(mocks.prompt.send).toHaveBeenCalledWith("Resuma as regras");
  });

  it("shows partial streaming text and stops without clearing it", async () => {
    const pointer = userEvent.setup();
    mocks.prompt.status = "streaming";
    mocks.prompt.responseText = "Resposta parcial";

    render(
      <FirstQuestionStep
        workspaceName="Atendimento"
        busy={false}
        finish={vi.fn()}
      />,
    );

    expect(screen.getByText("Resposta parcial")).toBeInTheDocument();
    await pointer.click(screen.getByRole("button", { name: "Parar" }));
    expect(mocks.prompt.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Resposta parcial")).toBeInTheDocument();
  });

  it("preserves the question after an error and permits completion", async () => {
    const pointer = userEvent.setup();
    mocks.prompt.status = "error";
    mocks.prompt.errorMessage = "Sem conexão com o servidor";
    const finish = vi.fn().mockResolvedValue(undefined);

    render(
      <FirstQuestionStep
        workspaceName="Atendimento"
        busy={false}
        finish={finish}
      />,
    );

    await pointer.type(
      screen.getByLabelText("Sua primeira pergunta"),
      "Minha pergunta",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sem conexão com o servidor",
    );
    expect(screen.getByDisplayValue("Minha pergunta")).toBeInTheDocument();

    await pointer.click(
      screen.getByRole("button", { name: "Concluir sem pergunta" }),
    );
    expect(finish).toHaveBeenCalledWith(undefined);
  });

  it("finishes directly in the created conversation", async () => {
    const pointer = userEvent.setup();
    mocks.prompt.status = "done";
    mocks.prompt.responseText = "Resposta final";
    mocks.prompt.conversationId = "conversation-1";
    const finish = vi.fn().mockResolvedValue(undefined);

    render(
      <FirstQuestionStep
        workspaceName="Atendimento"
        busy={false}
        finish={finish}
      />,
    );

    await pointer.click(
      screen.getByRole("button", { name: "Concluir e abrir no chat" }),
    );
    expect(finish).toHaveBeenCalledWith("/chat/conversation-1");
  });
});
