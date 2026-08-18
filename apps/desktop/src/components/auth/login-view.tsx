import { useMemo, useState } from "react";
import { registerInputSchema, type LoginInput, type RegisterInput } from "@linvo/shared";

import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthNotice,
} from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";

type AuthMode = "login" | "register";

type LoginViewProps = {
  error: string | null;
  sessionWarning: string | null;
  onLogin: (input: LoginInput) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
};

export function LoginView({
  error,
  sessionWarning,
  onLogin,
  onRegister,
}: LoginViewProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const validationError = useMemo(() => {
    if (!isRegister) {
      return null;
    }

    const parsed = registerInputSchema.safeParse({
      name,
      email,
      password,
    });

    if (!parsed.success) {
      return parsed.error.issues[0]?.message ?? "Dados inválidos";
    }

    if (password !== confirmPassword) {
      return "as senhas não coincidem";
    }

    return null;
  }, [isRegister, name, email, password, confirmPassword]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setLocalError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isRegister) {
      setLocalError(null);

      const parsed = registerInputSchema.safeParse({
        name,
        email,
        password,
      });

      if (!parsed.success) {
        setLocalError(parsed.error.issues[0]?.message ?? "Dados inválidos");
        return;
      }

      if (password !== confirmPassword) {
        setLocalError("as senhas não coincidem");
        return;
      }

      setSubmitting(true);
      try {
        await onRegister(parsed.data);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await onLogin({ email, password });
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = isRegister ? (localError ?? error ?? validationError) : error;
  const blocked = isRegister && Boolean(validationError);

  return (
    <AuthLayout
      title={isRegister ? "Criar conta" : "Bem-vindo de volta"}
      description={
        isRegister
          ? "Cadastre-se para usar o Linvo Desktop"
          : "Acesse sua conta para continuar"
      }
      footer={
        isRegister ? (
          <>
            Já tem uma conta?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-medium"
              onClick={() => switchMode("login")}
            >
              Entrar
            </Button>
          </>
        ) : (
          <>
            Não tem uma conta?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-medium"
              onClick={() => switchMode("register")}
            >
              Criar conta
            </Button>
          </>
        )
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {!isRegister && sessionWarning && <AuthNotice message={sessionWarning} />}
        {displayError && <AuthError message={displayError} />}
        {isRegister && (
          <AuthField
            id="register-name"
            label="Nome"
            placeholder="Nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="name"
          />
        )}
        <AuthField
          id={isRegister ? "register-email" : "login-email"}
          label="Email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
        <AuthField
          id={isRegister ? "register-password" : "login-password"}
          label="Senha"
          password
          placeholder="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete={isRegister ? "new-password" : "current-password"}
        />
        {isRegister && (
          <AuthField
            id="register-confirm-password"
            label="Confirmar senha"
            password
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
        )}
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={submitting || blocked}
        >
          {isRegister
            ? submitting
              ? "Criando..."
              : "Criar conta"
            : submitting
              ? "Entrando..."
              : "Entrar"}
        </Button>
      </form>
    </AuthLayout>
  );
}
