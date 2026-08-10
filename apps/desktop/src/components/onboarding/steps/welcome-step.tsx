import { LinvoLogo } from "@/components/linvo-logo";
import { StepPrimary } from "@/components/onboarding/step-shell";

export function WelcomeStep({
  busy = false,
  onContinue,
}: {
  busy?: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="flex h-full flex-col justify-center text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-hairline bg-surface-raise-1 shadow-inner-light">
        <LinvoLogo className="size-6 dark:invert" />
      </span>

      <h1 className="mt-7 font-display text-[1.9rem] leading-[1.15] font-semibold tracking-tight text-balance">
        Prepare o Linvo para trabalhar com você
      </h1>
      <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-relaxed text-text-secondary text-balance">
        São sete passos curtos: workspace, contexto e um tour rápido pela barra
        flutuante.
      </p>

      <StepPrimary
        autoFocus
        disabled={busy}
        onClick={onContinue}
        className="mt-8"
      >
        {busy ? "Aguarde..." : "Começar configuração"}
      </StepPrimary>

      <p className="mt-3.5 font-technical text-[10px] tracking-wide text-text-tertiary">
        Cerca de 2 minutos · dá para pular etapas
      </p>
    </section>
  );
}
