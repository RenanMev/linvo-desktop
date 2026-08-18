import type { AccentColor } from "@linvo/shared";

import { useAppearance } from "@/context/appearance-context";
import { cn } from "@/lib/utils";

import { AccentColorPicker } from "./accent-color-picker";

const ACCENT_OPTIONS: Array<{
  value: Exclude<AccentColor, "custom">;
  label: string;
  swatch: string;
  darkSwatch?: string;
}> = [
  { value: "purple", label: "Roxo", swatch: "#7c3aed" },
  {
    value: "graphite",
    label: "Grafite",
    swatch: "#141414",
    darkSwatch: "#ffffff",
  },
  { value: "blue", label: "Azul", swatch: "#2563eb" },
  { value: "green", label: "Verde", swatch: "#059669" },
  { value: "amber", label: "Âmbar", swatch: "#b45309" },
  { value: "rose", label: "Rosa", swatch: "#e11d48" },
];

export function AccentGroup() {
  const { preferences, setPreference } = useAppearance();
  const isCustom = preferences.accentColor === "custom";

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

      <div className="space-y-3 rounded-xl border border-hairline bg-muted/40 p-3">
        <div
          role="radiogroup"
          aria-label="Cor de destaque"
          className="grid grid-cols-4 gap-1.5 sm:grid-cols-7"
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
                  "group flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 text-[11px] font-medium transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
                  active
                    ? "border-hairline-strong bg-surface-raise-2 text-foreground shadow-[inset_0_0_0_1px_var(--hairline)]"
                    : "border-hairline text-foreground/70 hover:bg-surface-hover",
                )}
              >
                <span className="relative size-5 overflow-hidden rounded-full border border-hairline shadow-sm transition-transform duration-200 ease-out group-hover:scale-110">
                  <span
                    className="absolute inset-0 dark:hidden"
                    style={{ backgroundColor: option.swatch }}
                  />
                  <span
                    className="absolute inset-0 hidden dark:block"
                    style={{
                      backgroundColor: option.darkSwatch ?? option.swatch,
                    }}
                  />
                  {active ? (
                    <span className="absolute inset-0 ring-2 ring-ring ring-offset-1 ring-offset-background" />
                  ) : null}
                </span>
                {option.label}
              </button>
            );
          })}

          <button
            type="button"
            role="radio"
            aria-checked={isCustom}
            aria-label="Custom"
            onClick={() => setPreference("accentColor", "custom")}
            className={cn(
              "group flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 text-[11px] font-medium transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
              isCustom
                ? "border-hairline-strong bg-surface-raise-2 text-foreground shadow-[inset_0_0_0_1px_var(--hairline)]"
                : "border-hairline text-foreground/70 hover:bg-surface-hover",
            )}
          >
            <span
              className={cn(
                "relative size-5 overflow-hidden rounded-full border border-hairline shadow-sm transition-transform duration-200 ease-out group-hover:scale-110",
                isCustom && "ring-2 ring-ring ring-offset-1 ring-offset-background",
              )}
              style={{ backgroundColor: preferences.customAccentRgba }}
            />
            Custom
          </button>
        </div>

        {isCustom ? (
          <div className="space-y-2 border-t border-hairline pt-3">
            <p className="text-[11px] text-muted-foreground">
              Escolha qualquer cor RGBA para a cor de destaque.
            </p>
            <AccentColorPicker
              value={preferences.customAccentRgba}
              onChange={(rgba) => setPreference("customAccentRgba", rgba)}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
