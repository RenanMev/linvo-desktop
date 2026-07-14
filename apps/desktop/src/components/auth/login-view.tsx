import { useState } from "react";
import { Lock, Mail } from "lucide-react";
import type { LoginInput } from "@linvo/shared";

import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthNotice,
} from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";

type LoginViewProps = {
  error: string | null;
  sessionWarning: string | null;
  onLogin: (input: LoginInput) => Promise<void>;
  onGoToRegister: () => void;
};

export function LoginView({
  error,
  sessionWarning,
  onLogin,
  onGoToRegister,
}: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin({ email, password });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      description="Acesse sua conta para continuar"
      footer={
        <>
          Não tem uma conta?{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 font-medium"
            onClick={onGoToRegister}
          >
            Criar conta
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {sessionWarning && <AuthNotice message={sessionWarning} />}
        {error && <AuthError message={error} />}
        <AuthField
          id="login-email"
          label="Email"
          icon={Mail}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
        <AuthField
          id="login-password"
          label="Senha"
          icon={Lock}
          password
          placeholder="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
        />
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </AuthLayout>
  );
}
