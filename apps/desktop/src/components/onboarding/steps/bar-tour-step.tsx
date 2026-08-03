import { Check, GripVertical, Keyboard, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        "flex items-start gap-3 rounded-xl border p-3",
        done
          ? "border-success/35 bg-success/10"
          : "border-hairline bg-surface-raise-1",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
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
}: {
  busy?: boolean;
  onContinue: () => void;
}) {
  const { shortcutDone, dragDone, shortcutUnavailable } =
    useOnboardingBarTour();

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-5 space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Experimente a barra flutuante
        </h1>
        <p className="text-sm text-text-secondary">
          Faça os dois gestos agora. Você também pode seguir quando quiser.
        </p>
      </div>

      <div className="space-y-3">
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
      </div>

      {shortcutUnavailable ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Outro aplicativo pode estar usando esse atalho. Você pode continuar e
          tentar novamente depois.
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-hairline bg-surface-raise-1 p-3">
        <p className="mb-2 text-xs font-medium">Atalhos principais</p>
        <div className="flex flex-wrap gap-2 font-technical text-[11px] text-text-secondary">
          <kbd className="rounded-md border border-hairline bg-surface-raise-2 px-2 py-1">
            Ctrl+Shift+L
          </kbd>
          <kbd className="rounded-md border border-hairline bg-surface-raise-2 px-2 py-1">
            Enter
          </kbd>
          <kbd className="rounded-md border border-hairline bg-surface-raise-2 px-2 py-1">
            Esc
          </kbd>
        </div>
      </div>

      <div className="mt-auto flex justify-end border-t border-hairline pt-4">
        <Button
          type="button"
          autoFocus
          disabled={busy}
          onClick={onContinue}
        >
          {shortcutDone && dragDone ? "Continuar" : "Já entendi"}
        </Button>
      </div>
    </section>
  );
}
