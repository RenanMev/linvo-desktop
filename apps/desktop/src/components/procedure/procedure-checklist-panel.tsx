import { useEffect, useState } from "react";
import { Check, GripVertical, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChecklistProgress } from "@/lib/chat/desk-state";
import { cn } from "@/lib/utils";

type ProcedureChecklistPanelProps = {
  title: string;
  slug: string;
  steps: string[];
  initialCompleted?: number[];
  onProgressChange?: (progress: ChecklistProgress) => void;
  onClose: () => void;
};

export function ProcedureChecklistPanel({
  title,
  slug,
  steps,
  initialCompleted = [],
  onProgressChange,
  onClose,
}: ProcedureChecklistPanelProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const index of initialCompleted) {
      initial[index] = true;
    }
    return initial;
  });

  useEffect(() => {
    const completedStepIndexes = Object.entries(checked)
      .filter(([, value]) => value)
      .map(([key]) => Number(key))
      .sort((a, b) => a - b);
    const firstIncomplete = steps.findIndex((_, index) => !checked[index]);
    const currentStepIndex =
      firstIncomplete >= 0 ? firstIncomplete : Math.max(steps.length - 1, 0);
    onProgressChange?.({
      completedStepIndexes,
      currentStepIndex,
    });
  }, [checked, onProgressChange, steps.length]);

  function toggle(index: number) {
    setChecked((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-card text-card-foreground"
      aria-label="Checklist do procedure"
    >
      <div className="flex shrink-0 items-start gap-2 border-b px-2 py-3">
        <span
          data-tauri-drag-region
          title="Mover"
          className="mt-0.5 flex h-6 shrink-0 cursor-grab items-center rounded-md px-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
        >
          <GripVertical className="pointer-events-none size-3" />
        </span>
        <div className="min-w-0 flex-1" data-tauri-drag-region>
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">/{slug}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar"
        >
          <X />
        </Button>
      </div>

      <div className="scrollbar-elegant min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <ul className="space-y-1 pr-0.5">
          {steps.map((step, index) => {
            const isChecked = Boolean(checked[index]);
            return (
              <li key={`${index}-${step}`}>
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-2 py-2 text-sm",
                    "hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={step}
                    onClick={() => toggle(index)}
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors",
                      isChecked
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-transparent text-transparent",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </button>
                  <span className="leading-snug">{step}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
