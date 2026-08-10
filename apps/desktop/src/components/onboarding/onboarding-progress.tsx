import {
  ONBOARDING_STEP_ORDER,
  type OnboardingStepId,
  type StepStatus,
} from "@/lib/onboarding/onboarding-steps";
import { cn } from "@/lib/utils";

type OnboardingProgressProps = {
  steps: Array<{ id: OnboardingStepId; status: StepStatus }>;
  currentStepId: OnboardingStepId;
  forced?: boolean;
};

/**
 * Progresso do fluxo: contador e uma fileira de traços. Substitui o trilho
 * lateral — a etapa atual já é o título da tela, aqui só se mostra onde ela
 * fica no caminho. Os traços são decorativos; o texto carrega a informação.
 */
export function OnboardingProgress({
  steps,
  currentStepId,
  forced = false,
}: OnboardingProgressProps) {
  const states = new Map(steps.map((step) => [step.id, step.status]));
  const position = ONBOARDING_STEP_ORDER.indexOf(currentStepId) + 1;

  return (
    <div className="flex shrink-0 flex-col items-center gap-2.5">
      <p
        aria-live="polite"
        className="font-technical text-[10px] uppercase tracking-[0.16em] text-text-tertiary"
      >
        Etapa {position} de {ONBOARDING_STEP_ORDER.length}
      </p>

      <div aria-hidden className="flex items-center gap-1.5">
        {ONBOARDING_STEP_ORDER.map((id, index) => {
          const status = states.get(id) ?? "pending";
          const current = id === currentStepId;
          const behind = index < position - 1;

          return (
            <span
              key={id}
              className={cn(
                "h-[3px] rounded-full transition-all duration-300 ease-out",
                current && "w-7 bg-accent-active",
                !current &&
                  behind &&
                  (status === "skipped"
                    ? "w-4 bg-surface-hover"
                    : "w-4 bg-accent-active/45"),
                !current && !behind && "w-4 bg-surface-raise-2",
              )}
            />
          );
        })}
      </div>

      {forced ? (
        <p className="font-technical text-[10px] uppercase tracking-[0.16em] text-warning">
          Modo forçado
        </p>
      ) : null}
    </div>
  );
}
