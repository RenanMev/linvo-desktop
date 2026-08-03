import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatToolApproval } from "@/components/chat/chat-tool-approval";

describe("ChatToolApproval", () => {
  it("chama onApprove e onDeny", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onDeny = vi.fn();

    render(
      <ChatToolApproval
        request={{
          requestId: "r1",
          name: "read_clipboard",
          label: "Área de transferência",
          args: {},
          requiresApproval: true,
        }}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    await user.click(screen.getByRole("button", { name: "Recusar" }));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it("mostra preview ao criar procedimento", () => {
    render(
      <ChatToolApproval
        request={{
          requestId: "r2",
          name: "create_procedure",
          label: "Criar procedimento",
          args: {
            title: "Cancelamento de planos",
            steps: ["Abrir CRM", "Validar status", "Cancelar"],
          },
          requiresApproval: true,
        }}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    expect(screen.getByText("Criar procedimento publicado:")).toBeInTheDocument();
    expect(screen.getByText("Cancelamento de planos")).toBeInTheDocument();
    expect(screen.getByText("Abrir CRM")).toBeInTheDocument();
  });

  it("mostra fallback genérico para tool desconhecida", () => {
    render(
      <ChatToolApproval
        request={{
          requestId: "r3",
          name: "custom_tool",
          label: "Ferramenta custom",
          args: { path: "/tmp/file" },
          requiresApproval: true,
        }}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    expect(
      screen.getByText("O assistente pediu aprovação para usar esta ferramenta."),
    ).toBeInTheDocument();
    expect(screen.getByText(/path: \/tmp\/file/)).toBeInTheDocument();
  });

  describe("generate_pdf", () => {
    const pdfRequest = {
      requestId: "r4",
      name: "generate_pdf",
      label: "Gerar PDF",
      args: {
        title: "Relatório de julho",
        markdown: "# Relatório de julho\n\nVendas cresceram 12%.",
      },
      requiresApproval: true,
    };

    it("destaca o título e mantém a prévia colapsada", () => {
      render(
        <ChatToolApproval
          request={pdfRequest}
          onApprove={vi.fn()}
          onDeny={vi.fn()}
        />,
      );

      expect(screen.getByText("Gerar um PDF para download:")).toBeInTheDocument();
      expect(screen.getByText("Relatório de julho")).toBeInTheDocument();
      expect(screen.queryByText("Vendas cresceram 12%.")).not.toBeInTheDocument();
    });

    it("abre e fecha a prévia do markdown", async () => {
      const user = userEvent.setup();
      render(
        <ChatToolApproval
          request={pdfRequest}
          onApprove={vi.fn()}
          onDeny={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Ver prévia" }));
      expect(screen.getByText("Vendas cresceram 12%.")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Ocultar prévia" }));
      expect(screen.queryByText("Vendas cresceram 12%.")).not.toBeInTheDocument();
    });

    it("mantém aprovar e recusar funcionando", async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      const onDeny = vi.fn();

      render(
        <ChatToolApproval
          request={pdfRequest}
          onApprove={onApprove}
          onDeny={onDeny}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Aprovar" }));
      await user.click(screen.getByRole("button", { name: "Recusar" }));

      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onDeny).toHaveBeenCalledTimes(1);
    });
  });
});
