import { useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProcedureChecklistPanelProps = {
  title: string;
  slug: string;
  steps: string[];
  onClose: () => void;
};

export function ProcedureChecklistPanel({
  title,
  slug,
  steps,
  onClose,
}: ProcedureChecklistPanelProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  function toggle(index: number) {
    setChecked((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }

  return (
    <aside
      className="flex h-full min-h-0 w-72 shrink-0 flex-col border-l bg-card text-card-foreground shadow-sm"
      aria-label="Checklist do procedure"
    >
      <div className="flex items-start gap-2 border-b px-3 py-3">
        <div className="min-w-0 flex-1">
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

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
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
    </aside>
  );
}
