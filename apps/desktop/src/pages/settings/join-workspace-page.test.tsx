import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JoinWorkspacePage } from "@/pages/settings/join-workspace-page";

const redeemInviteCode = vi.fn();
const applyRedeemedWorkspace = vi.fn();

vi.mock("@/lib/workspace/invite-api", () => ({
  redeemInviteCode: (...args: unknown[]) => redeemInviteCode(...args),
}));

vi.mock("@/context/workspace-context", () => ({
  useWorkspace: () => ({
    applyRedeemedWorkspace,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/workspace/join"]}>
      <Routes>
        <Route path="/settings/workspace/join" element={<JoinWorkspacePage />} />
        <Route path="/chat" element={<div>Chat</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("JoinWorkspacePage", () => {
  beforeEach(() => {
    redeemInviteCode.mockReset();
    applyRedeemedWorkspace.mockReset();
    applyRedeemedWorkspace.mockResolvedValue(undefined);
  });

  it("normalizes paste variants to the same redeem payload", async () => {
    const user = userEvent.setup();
    redeemInviteCode.mockResolvedValue({
      workspace: {
        id: "ws-1",
        name: "Ops",
        role: "MEMBER",
        imageUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      alreadyMember: false,
    });

    renderPage();
    const input = screen.getByLabelText("Código de acesso");

    await user.click(input);
    await user.paste("h7kp 3rqm\n");

    expect(input).toHaveValue("H7KP-3RQM");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(redeemInviteCode).toHaveBeenCalledWith("H7KP3RQM");
    });
  });

  it("ignores invalid alphabet characters without showing an error", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText("Código de acesso");

    await user.type(input, "H7KP OI01");

    expect(input).toHaveValue("H7KP");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Entrar" }),
    ).toBeDisabled();
  });

  it("enables submit only with 8 valid characters", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText("Código de acesso");
    const button = screen.getByRole("button", { name: "Entrar" });

    expect(button).toBeDisabled();
    await user.type(input, "H7KP3RQ");
    expect(button).toBeDisabled();
    await user.type(input, "M");
    expect(button).toBeEnabled();
  });

  it("shows API message on 400 and keeps the field value", async () => {
    const user = userEvent.setup();
    const { AuthApiError } = await import("@/lib/auth/auth-api");
    redeemInviteCode.mockRejectedValue(
      new AuthApiError("Código de acesso inválido.", 400),
    );

    renderPage();
    const input = screen.getByLabelText("Código de acesso");
    await user.type(input, "H7KP3RQM");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Código de acesso inválido.",
    );
    expect(input).toHaveValue("H7KP-3RQM");
  });

  it("shows rate-limit copy on 429", async () => {
    const user = userEvent.setup();
    const { AuthApiError } = await import("@/lib/auth/auth-api");
    redeemInviteCode.mockRejectedValue(new AuthApiError("ignored", 429));

    renderPage();
    await user.type(screen.getByLabelText("Código de acesso"), "H7KP3RQM");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas. Tente novamente em alguns minutos.",
    );
  });

  it("updates active workspace before navigating on success", async () => {
    const user = userEvent.setup();
    const workspace = {
      id: "ws-9",
      name: "Empresa",
      role: "MEMBER" as const,
      imageUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    redeemInviteCode.mockResolvedValue({
      workspace,
      alreadyMember: false,
    });

    renderPage();
    await user.type(screen.getByLabelText("Código de acesso"), "H7KP3RQM");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(applyRedeemedWorkspace).toHaveBeenCalledWith(workspace);
    });
    expect(await screen.findByText("Chat")).toBeInTheDocument();
  });
});
