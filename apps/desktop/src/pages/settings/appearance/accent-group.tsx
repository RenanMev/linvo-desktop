import type { AccentColor } from "@linvo/shared";

import { useAppearance } from "@/context/appearance-context";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS: Array<{
  value: AccentColor;
  label: string;
  swatchClass: string;
}> = [
  { value: "purple", label: "Roxo", swatchClass: "bg-[#7c3aed]" },
  { value: "graphite", label: "Grafite", swatchClass: "bg-[#141414] dark:bg-white" },
  { value: "blue", label: "Azul", swatchClass: "bg-[#2563eb]" },
  { value: "green", label: "Verde", swatchClass: "bg-[#059669]" },
  { value: "amber", label: "Âmbar", swatchClass: "bg-[#b45309]" },
  { value: "rose", label: "Rosa", swatchClass: "bg-[#e11d48]" },
];

export function AccentGroup() {
  const { preferences, setPreference } = useAppearance();

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cor de destaque
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Usada em estados ativos, seleção e foco em todo o app.
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-muted/40 p-3">
        <div
          role="radiogroup"
          aria-label="Cor de destaque"
          className="grid grid-cols-3 gap-1.5 sm:grid-cols-6"
        >
          {ACCENT_OPTIONS.map((option) => {
            const active = preferences.accentColor === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={option.label}
                onClick={() => setPreference("accentColor", option.value)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
                  active
                    ? "border-hairline-strong bg-surface-raise-2 text-foreground"
                    : "border-hairline text-foreground/70 hover:bg-surface-hover",
                )}
              >
                <span
                  className={cn(
                    "size-4 rounded-full border border-hairline transition-transform duration-200 ease-out group-hover:scale-110",
                    option.swatchClass,
                    active && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                  )}
                />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
