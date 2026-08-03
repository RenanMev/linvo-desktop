import type { ThemeMode } from "@linvo/shared";
import { Laptop, Moon, Sun } from "lucide-react";

import { useAppearance } from "@/context/appearance-context";
import { cn } from "@/lib/utils";

const THEME_MODE_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "system", label: "Sistema", icon: Laptop },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

export function ThemeModeGroup() {
  const { preferences, setPreference } = useAppearance();

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tema
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Controla o modo claro/escuro do Linvo.
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-muted/40 p-3">
        <div
          role="radiogroup"
          aria-label="Tema"
          className="grid grid-cols-3 gap-1.5"
        >
          {THEME_MODE_OPTIONS.map((option) => {
            const active = preferences.themeMode === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={option.label}
                onClick={() => setPreference("themeMode", option.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium outline-none transition-[background-color,border-color,color,transform] duration-200 ease-out hover:-translate-y-px focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-0 active:scale-[0.96]",
                  active
                    ? "border-hairline-strong bg-surface-raise-2 text-foreground"
                    : "border-hairline text-foreground/70 hover:bg-surface-hover",
                )}
              >
                <Icon className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
