import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Procedure } from "@linvo/shared";

import { ChatInput } from "@/components/chat/chat-input";
import { AuthApiError } from "@/lib/auth/auth-api";

vi.mock("@/lib/procedure/procedure-api", () => ({
  listProcedures: vi.fn(),
  getProcedureBySlug: vi.fn(),
}));

import * as procedureApi from "@/lib/procedure/procedure-api";

const published: Procedure = {
  id: "proc-1",
  workspaceId: "ws-1",
  status: "PUBLISHED",
  title: "Número cancelado",
  slug: "numero_cancelado",
  markdown: "## Título / tema\n\nx",
  steps: ["Passo 1", "Passo 2"],
  retainVideo: false,
  videoPath: null,
  error: null,
  attemptCount: 1,
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
};

const otherPublished: Procedure = {
  ...published,
  id: "proc-2",
  title: "Troca de chip",
  slug: "troca_chip",
  steps: ["A"],
};

function renderInput(
  overrides: Partial<ComponentProps<typeof ChatInput>> = {},
) {
  const onOpenProcedureChecklist = vi.fn();
  const onSend = vi.fn();
  render(
    <ChatInput
      onSend={onSend}
      isResponding={false}
      replyTarget={null}
      onCancelReply={vi.fn()}
      workspaceId="ws-1"
      onOpenProcedureChecklist={onOpenProcedureChecklist}
      {...overrides}
    />,
  );
  return { onOpenProcedureChecklist, onSend };
}

describe("ChatInput slash procedure autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(procedureApi.listProcedures).mockResolvedValue([
      published,
      otherPublished,
    ]);
    vi.mocked(procedureApi.getProcedureBySlug).mockResolvedValue(published);
  });

  it("lists published procedure slugs when typing slash", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.type(
      screen.getByPlaceholderText("Pergunte qualquer coisa..."),
      "/",
    );

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "/numero_cancelado" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "/troca_chip" })).toBeInTheDocument();
    });
    expect(procedureApi.listProcedures).toHaveBeenCalledWith("ws-1", [
      "PUBLISHED",
    ]);
  });

  it("filters autocomplete to matching published slugs", async () => {
    const user = userEvent.setup();
    renderInput();

    await user.type(
      screen.getByPlaceholderText("Pergunte qualquer coisa..."),
      "/numero",
    );

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "/numero_cancelado" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("option", { name: "/troca_chip" }),
    ).not.toBeInTheDocument();
  });

  it("opens checklist when a published slug is selected", async () => {
    const user = userEvent.setup();
    const { onOpenProcedureChecklist, onSend } = renderInput();

    await user.type(
      screen.getByPlaceholderText("Pergunte qualquer coisa..."),
      "/",
    );
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "/numero_cancelado" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: "/numero_cancelado" }));

    await waitFor(() => {
      expect(onOpenProcedureChecklist).toHaveBeenCalledWith(published);
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not open checklist for invalid slug and shows not found", async () => {
    const user = userEvent.setup();
    vi.mocked(procedureApi.getProcedureBySlug).mockRejectedValue(
      new AuthApiError("não encontrado", 404),
    );
    const { onOpenProcedureChecklist, onSend } = renderInput();

    const textarea = screen.getByPlaceholderText("Pergunte qualquer coisa...");
    await user.type(textarea, "/slug_inexistente{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText(/procedure não foi encontrado/i),
      ).toBeInTheDocument();
    });
    expect(onOpenProcedureChecklist).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });
});
