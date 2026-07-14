import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginView } from "@/components/auth/login-view";
import { RegisterView } from "@/components/auth/register-view";

describe("LoginView", () => {
  it("renders login form", () => {
    render(
      <LoginView
        error={null}
        sessionWarning={null}
        onLogin={vi.fn()}
        onGoToRegister={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("shows session warning", () => {
    render(
      <LoginView
        error={null}
        sessionWarning="Não foi possível validar sua sessão"
        onLogin={vi.fn()}
        onGoToRegister={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Não foi possível validar sua sessão"),
    ).toBeInTheDocument();
  });

  it("submits credentials", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);

    render(
      <LoginView
        error={null}
        sessionWarning={null}
        onLogin={onLogin}
        onGoToRegister={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("Email"), "renan@example.com");
    await user.type(screen.getByPlaceholderText("Senha"), "Abcdef1!");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(onLogin).toHaveBeenCalledWith({
      email: "renan@example.com",
      password: "Abcdef1!",
    });
  });
});

describe("RegisterView", () => {
  it("blocks mismatched passwords", () => {
    render(
      <RegisterView
        error={null}
        onRegister={vi.fn()}
        onGoToLogin={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Criar conta" })).toBeDisabled();
  });

  it("shows password mismatch message", async () => {
    const user = userEvent.setup();

    render(
      <RegisterView
        error={null}
        onRegister={vi.fn()}
        onGoToLogin={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("Nome"), "Renan");
    await user.type(screen.getByPlaceholderText("Email"), "renan@example.com");
    await user.type(screen.getByPlaceholderText("Senha"), "Abcdef1!");
    await user.type(screen.getByPlaceholderText("Confirmar senha"), "Different1!");

    expect(screen.getByText("as senhas não coincidem")).toBeInTheDocument();
  });
});
