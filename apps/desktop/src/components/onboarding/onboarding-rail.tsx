import { Check, Circle, Minus } from "lucide-react";

import {
  ONBOARDING_STEP_ORDER,
  isStepNavigable,
  type OnboardingStepId,
  type StepStatus,
} from "@/lib/onboarding/onboarding-steps";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<OnboardingStepId, string> = {
  welcome: "Boas-vindas",
  workspace: "Workspace",
  context: "Contexto",
  knowledge: "Conhecimento",
  appearance: "Aparência",
  bar_tour: "Barra flutuante",
  first_question: "Primeira pergunta",
};

type OnboardingRailProps = {
  steps: Array<{ id: OnboardingStepId; status: StepStatus }>;
  currentStepId: OnboardingStepId;
  onSelect: (id: OnboardingStepId) => void;
  forced: boolean;
  processingIds?: Set<OnboardingStepId>;
};

export function OnboardingRail({
  steps,
  currentStepId,
  onSelect,
  forced,
  processingIds,
}: OnboardingRailProps) {
  const states = new Map(steps.map((step) => [step.id, step.status]));

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-hairline bg-sidebar px-4 py-5 text-sidebar-foreground">
      <div className="mb-7 px-2">
        <p className="font-display text-sm font-semibold tracking-tight">
          Configuração inicial
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Prepare o Linvo para o seu trabalho.
        </p>
        {forced ? (
          <p className="mt-2 font-technical text-[10px] uppercase tracking-wider text-text-tertiary">
            Modo forçado
          </p>
        ) : null}
      </div>

      <nav aria-label="Etapas do onboarding" className="flex flex-col gap-1">
        {ONBOARDING_STEP_ORDER.map((id, index) => {
          const status = states.get(id) ?? "pending";
          const navigable = isStepNavigable(status);
          const current = id === currentStepId;
          const StatusIcon =
            status === "completed"
              ? Check
              : status === "skipped"
                ? Minus
                : Circle;

          return (
            <button
              key={id}
              type="button"
              aria-current={current ? "step" : undefined}
              aria-disabled={!navigable}
              tabIndex={navigable ? 0 : -1}
              onClick={() => {
                if (navigable) {
                  onSelect(id);
                }
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                status === "current" &&
                  "bg-sidebar-accent text-sidebar-accent-foreground",
                status === "completed" &&
                  "cursor-pointer text-foreground hover:bg-sidebar-accent/70",
                status === "skipped" &&
                  "cursor-pointer text-text-secondary hover:bg-sidebar-accent/70",
                status === "pending" && "cursor-default text-text-tertiary",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border font-technical text-[10px]",
                  status === "current" &&
                    "border-accent-active bg-accent-active text-accent-active-foreground",
                  status === "completed" &&
                    "border-success/40 bg-success/10 text-success",
                  status === "skipped" &&
                    "border-hairline-strong text-text-secondary",
                  status === "pending" &&
                    "border-hairline text-text-tertiary",
                )}
              >
                {status === "pending" || status === "current" ? (
                  index + 1
                ) : (
                  <StatusIcon className="size-3" />
                )}
              </span>
              <span className="truncate">{STEP_LABELS[id]}</span>
              {processingIds?.has(id) ? (
                <span
                  aria-label={`${STEP_LABELS[id]} em processamento`}
                  className="ml-auto size-1.5 shrink-0 animate-pulse rounded-full bg-warning"
                />
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
