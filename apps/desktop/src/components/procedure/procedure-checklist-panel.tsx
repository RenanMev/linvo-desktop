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

  const completedCount = steps.filter((_, index) => checked[index]).length;
  const progressPercent =
    steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col text-card-foreground"
      aria-label="Checklist do procedure"
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-hairline px-2.5 py-3">
        <span
          data-tauri-drag-region
          title="Mover"
          className="mt-0.5 flex h-6 shrink-0 cursor-grab items-center rounded-full px-0.5 text-foreground/35 transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="pointer-events-none size-3" />
        </span>
        <div className="min-w-0 flex-1" data-tauri-drag-region>
          <p className="truncate text-sm font-medium tracking-tight">{title}</p>
          <p className="truncate font-technical text-[10px] tracking-wide text-muted-foreground">
            /{slug}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar"
          className="rounded-full text-foreground/50 hover:text-foreground"
        >
          <X />
        </Button>
      </div>

      <div className="shrink-0 px-3 py-2.5">
        <div className="mb-1.5 flex items-baseline justify-between font-technical text-[10px] tracking-wide text-muted-foreground">
          <span>
            {completedCount}/{steps.length}
          </span>
          <span
            className={progressPercent === 100 ? "text-progress" : undefined}
          >
            {progressPercent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-label="Progresso do checklist"
          className="h-0.5 w-full overflow-hidden rounded-full bg-surface-raise-2"
        >
          <div
            className="h-full rounded-full bg-progress transition-[width] duration-300 ease-out"
            style={{
              width: `${progressPercent}%`,
              boxShadow: "0 0 6px rgba(16,185,129,0.6)",
            }}
          />
        </div>
      </div>

      <div className="scrollbar-elegant min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <ul className="space-y-1 pr-0.5">
          {steps.map((step, index) => {
            const isChecked = Boolean(checked[index]);
            return (
              <li key={`${index}-${step}`}>
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors",
                    "hover:bg-surface-hover",
                    isChecked && "text-foreground/45",
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={step}
                    onClick={() => toggle(index)}
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] border transition-all duration-150",
                      isChecked
                        ? "border-progress bg-progress text-progress-foreground"
                        : "border-hairline-strong bg-transparent text-transparent hover:border-hairline-strong",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </button>
                  <span
                    className={cn(
                      "leading-snug",
                      isChecked && "line-through decoration-white/25",
                    )}
                  >
                    {step}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
