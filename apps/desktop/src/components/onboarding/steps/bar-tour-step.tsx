import { Check, GripVertical, Keyboard, TriangleAlert } from "lucide-react";

import {
  StepActions,
  StepHeader,
  StepLink,
  StepPrimary,
} from "@/components/onboarding/step-shell";
import { useOnboardingBarTour } from "@/hooks/use-onboarding-bar-tour";
import { cn } from "@/lib/utils";

function GestureItem({
  done,
  icon: Icon,
  title,
  description,
}: {
  done: boolean;
  icon: typeof Keyboard;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition-colors",
        done
          ? "border-success/35 bg-success/10"
          : "border-hairline bg-surface-raise-1",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
          done
            ? "bg-success/15 text-success"
            : "bg-surface-raise-2 text-text-secondary",
        )}
      >
        {done ? <Check className="size-4" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
          {description}
        </span>
      </span>
    </div>
  );
}

export function BarTourStep({
  busy = false,
  onContinue,
  onBack,
}: {
  busy?: boolean;
  onContinue: () => void;
  onBack?: () => void;
}) {
  const { shortcutDone, dragDone, shortcutUnavailable } =
    useOnboardingBarTour();

  return (
    <section className="flex h-full min-h-0 flex-col">
      <StepHeader
        title="Experimente a barra flutuante"
        description="Faça os dois gestos agora. Você também pode seguir quando quiser."
      />

      <div className="min-h-0 flex-1 space-y-2.5">
        <GestureItem
          done={shortcutDone}
          icon={Keyboard}
          title="Acione o atalho global"
          description="Pressione Ctrl+Shift+L. Durante esta etapa, a janela não será ocultada."
        />
        <GestureItem
          done={dragDone}
          icon={GripVertical}
          title="Arraste a janela"
          description="Use a região superior de arraste e mova o Linvo pelo monitor."
        />

        {shortcutUnavailable ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-[11px] leading-relaxed text-warning-foreground"
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
            Outro aplicativo pode estar usando esse atalho. Você pode continuar
            e tentar novamente depois.
          </div>
        ) : null}
      </div>

      <StepActions
        links={
          onBack ? (
            <StepLink disabled={busy} onClick={onBack}>
              Voltar
            </StepLink>
          ) : undefined
        }
      >
        <StepPrimary autoFocus disabled={busy} onClick={onContinue}>
          {shortcutDone && dragDone ? "Continuar" : "Já entendi"}
        </StepPrimary>
      </StepActions>
    </section>
  );
}
