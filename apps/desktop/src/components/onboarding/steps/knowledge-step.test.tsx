import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KnowledgeStep } from "@/components/onboarding/steps/knowledge-step";

function makeSession() {
  return {
    id: "session-1",
    workspaceId: "ws-1",
    status: "PROCESSING" as const,
    approvalMode: "QUESTION" as const,
    confidenceThreshold: 0.7,
    error: null,
    documents: [{ id: "doc-1" }],
    candidates: [{ id: "candidate-1" }, { id: "candidate-2" }],
    events: [],
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  } as never;
}

function renderStep(
  overrides: Partial<React.ComponentProps<typeof KnowledgeStep>> = {},
) {
  const props: React.ComponentProps<typeof KnowledgeStep> = {
    session: null,
    isPolling: false,
    error: null,
    knowledgeIntent: null,
    onConfirmFiles: vi.fn().mockResolvedValue(undefined),
    onSelectProcedures: vi.fn(),
    onContinue: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
  render(<KnowledgeStep {...props} />);
  return props;
}

describe("KnowledgeStep", () => {
  it("keeps valid files and rejects unsupported ones inline", () => {
    const pdf = new File(["pdf"], "manual.pdf", {
      type: "application/pdf",
    });
    const image = new File(["png"], "foto.png", { type: "image/png" });
    renderStep();

    fireEvent.change(screen.getByLabelText("Documentos de conhecimento"), {
      target: { files: [pdf, image] },
    });

    expect(screen.getByText("manual.pdf")).toBeInTheDocument();
    expect(screen.queryByText("foto.png")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 arquivo não é compatível",
    );
  });

  it("rejects empty and oversized files before upload", () => {
    const empty = new File([], "vazio.pdf", { type: "application/pdf" });
    const oversized = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "grande.pdf",
      { type: "application/pdf" },
    );
    renderStep();

    fireEvent.change(screen.getByLabelText("Documentos de conhecimento"), {
      target: { files: [empty, oversized] },
    });

    expect(screen.queryByText("vazio.pdf")).toBeNull();
    expect(screen.queryByText("grande.pdf")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Arquivos vazios não podem ser enviados",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cada arquivo deve ter no máximo 5 MB",
    );
  });

  it("uploads selected files and renders session progress", async () => {
    const pointer = userEvent.setup();
    const props = renderStep({
      session: makeSession(),
      isPolling: true,
    });
    const text = new File(["context"], "contexto.txt", {
      type: "text/plain",
    });

    fireEvent.change(screen.getByLabelText("Documentos de conhecimento"), {
      target: { files: [text] },
    });
    await pointer.click(
      screen.getByRole("button", { name: "Processar documentos" }),
    );

    expect(props.onConfirmFiles).toHaveBeenCalledWith([text]);
    expect(screen.getByRole("status")).toHaveTextContent("1 documento");
    expect(screen.getByRole("status")).toHaveTextContent("2 candidatos");
  });

  it("allows continuing during processing and after a non-blocking error", async () => {
    const pointer = userEvent.setup();
    const props = renderStep({
      session: makeSession(),
      isPolling: true,
      error: "Não foi possível atualizar o progresso",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível atualizar o progresso",
    );
    await pointer.click(screen.getByRole("button", { name: "Continuar" }));
    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });

  it("marks the Procedures intent without starting an upload", async () => {
    const pointer = userEvent.setup();
    const props = renderStep();

    await pointer.click(screen.getByRole("button", { name: /Procedures/ }));

    expect(props.onSelectProcedures).toHaveBeenCalledTimes(1);
    expect(props.onConfirmFiles).not.toHaveBeenCalled();
  });
});
