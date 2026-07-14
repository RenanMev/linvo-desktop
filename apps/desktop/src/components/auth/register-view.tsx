import { useMemo, useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { registerInputSchema, type RegisterInput } from "@linvo/shared";

import {
  AuthError,
  AuthField,
  AuthLayout,
} from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";

type RegisterViewProps = {
  error: string | null;
  onRegister: (input: RegisterInput) => Promise<void>;
  onGoToLogin: () => void;
};

export function RegisterView({
  error,
  onRegister,
  onGoToLogin,
}: RegisterViewProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validationError = useMemo(() => {
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
  }, [name, email, password, confirmPassword]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
  };

  const displayError = localError ?? error ?? validationError;
  const blocked = Boolean(validationError);

  return (
    <AuthLayout
      title="Criar conta"
      description="Cadastre-se para usar o Linvo Desktop"
      footer={
        <>
          Já tem uma conta?{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 font-medium"
            onClick={onGoToLogin}
          >
            Entrar
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {displayError && <AuthError message={displayError} />}
        <AuthField
          id="register-name"
          label="Nome"
          icon={User}
          placeholder="Nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="name"
        />
        <AuthField
          id="register-email"
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
          id="register-password"
          label="Senha"
          icon={Lock}
          password
          placeholder="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="new-password"
        />
        <AuthField
          id="register-confirm-password"
          label="Confirmar senha"
          icon={Lock}
          password
          placeholder="Confirmar senha"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          autoComplete="new-password"
        />
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={submitting || blocked}
        >
          {submitting ? "Criando..." : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
