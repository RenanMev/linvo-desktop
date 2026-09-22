import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";

import { AuthField } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type IslandReauthProps = {
  email: string;
  onSubmit: (password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

/*
 * Reauth compacto dentro da ilha.
 *
 * Quando a sessão cai no meio do turno, a janela não vira a tela de login:
 * o atendente está com um ticket aberto e o Assist tem que voltar no lugar
 * em que estava. Só a senha — o e-mail é o da sessão que caiu. Quem quiser
 * outra conta (ou entrou por SSO) sai e passa pelo login completo.
 */
export function IslandReauth({ email, onSubmit, onSignOut }: IslandReauthProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Não foi possível entrar",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      aria-label="Entrar de novo"
      className="flex min-h-0 flex-1 flex-col justify-center gap-4 px-5 py-4"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-9 place-items-center rounded-lg bg-popover text-text-tertiary">
          <KeyRound className="size-4" />
        </span>
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold text-foreground">
            Sua sessão expirou
          </h2>
          <p className="text-xs text-muted-foreground">
            Entre de novo para continuar de onde parou.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <label
            htmlFor="island-reauth-email"
            className="text-sm font-medium text-foreground"
          >
            Email
          </label>
          {/* Campo de verdade (readOnly): o gerenciador de senhas precisa de um
              username para casar o current-password, e o label precisa de
              um elemento rotulável. */}
          <Input
            id="island-reauth-email"
            type="email"
            value={email}
            readOnly
            autoComplete="username"
            className="h-11 font-technical text-xs text-muted-foreground"
          />
        </div>
        <AuthField
          id="island-reauth-password"
          label="Senha"
          password
          placeholder="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoFocus
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting || !password}>
        {submitting ? "Entrando..." : "Entrar"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => void onSignOut()}
        className="self-center text-muted-foreground"
      >
        Usar outra conta
      </Button>
    </form>
  );
}
