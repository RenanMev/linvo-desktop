import { Button } from "@/components/ui/button";
import { AccentGroup } from "@/pages/settings/appearance/accent-group";
import { ThemeModeGroup } from "@/pages/settings/appearance/theme-mode-group";

export function AppearanceStep({
  busy,
  onContinue,
}: {
  busy: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-5 space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Deixe o Linvo com a sua cara
        </h1>
        <p className="text-sm text-text-secondary">
          As mudanças aparecem agora e acompanham você nas outras janelas.
        </p>
      </div>

      <div className="scrollbar-elegant min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <ThemeModeGroup />
        <AccentGroup />
      </div>

      <div className="mt-5 flex justify-end border-t border-hairline pt-4">
        <Button
          type="button"
          disabled={busy}
          autoFocus
          onClick={onContinue}
        >
          Continuar
        </Button>
      </div>
    </section>
  );
}
