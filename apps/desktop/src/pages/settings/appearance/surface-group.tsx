import type { BlurLevel } from "@linvo/shared";

import { useAppearance } from "@/context/appearance-context";
import { cn } from "@/lib/utils";

const BLUR_OPTIONS: Array<{ value: BlurLevel; label: string }> = [
  { value: "off", label: "Desligado" },
  { value: "light", label: "Leve" },
  { value: "medium", label: "Médio" },
  { value: "strong", label: "Forte" },
];

const LOW_CONTRAST_OPACITY_THRESHOLD = 65;

export function SurfaceGroup() {
  const { preferences, setPreference } = useAppearance();

  const showContrastWarning =
    preferences.panelOpacity < LOW_CONTRAST_OPACITY_THRESHOLD &&
    preferences.blurLevel === "off";

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Superfície
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Controla o quanto o painel deixa passar o fundo e o quanto ele borra.
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="panel-opacity"
            className="text-xs font-medium"
          >
            Opacidade do painel
          </label>
          <span className="font-technical text-xs tabular-nums text-muted-foreground">
            {preferences.panelOpacity}%
          </span>
        </div>
        <input
          id="panel-opacity"
          type="range"
          min={55}
          max={100}
          step={1}
          value={preferences.panelOpacity}
          aria-label="Opacidade do painel"
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-raise-2 accent-accent-active"
          onChange={(event) =>
            setPreference("panelOpacity", Number(event.target.value))
          }
        />
      </div>

      <div className="rounded-xl border border-hairline bg-muted/40 p-3">
        <p className="text-xs font-medium">Intensidade do blur</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          "Desligado" reduz o custo de composição da janela.
        </p>
        <div className="mt-2.5 flex gap-1.5">
          {BLUR_OPTIONS.map((option) => {
            const active = preferences.blurLevel === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreference("blurLevel", option.value)}
                aria-pressed={active}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "nav-pill-active"
                    : "border border-hairline text-foreground/70 hover:bg-surface-hover",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {showContrastWarning ? (
        <p
          role="status"
          className="rounded-lg border border-hairline bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
        >
          Opacidade baixa sem blur pode reduzir a legibilidade do texto.
        </p>
      ) : null}
    </section>
  );
}
