import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WelcomeStep({
  busy = false,
  onContinue,
}: {
  busy?: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="flex h-full flex-col justify-center">
      <div className="max-w-xl space-y-5">
        <span className="grid size-10 place-items-center rounded-xl border border-hairline bg-surface-raise-1">
          <Sparkles className="size-4 text-text-secondary" />
        </span>
        <div className="space-y-2">
          <p className="font-technical text-[11px] uppercase tracking-wider text-text-tertiary">
            Bem-vindo
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Prepare o Linvo para trabalhar com você
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-text-secondary">
            Em poucos passos, vamos criar seu workspace, adicionar contexto e
            mostrar como acessar o assistente em qualquer tela.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          autoFocus
          disabled={busy}
          onClick={onContinue}
        >
          {busy ? "Aguarde..." : "Começar configuração"}
        </Button>
      </div>
    </section>
  );
}
