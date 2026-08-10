import {
  StepActions,
  StepHeader,
  StepLink,
  StepPrimary,
} from "@/components/onboarding/step-shell";
import { AccentGroup } from "@/pages/settings/appearance/accent-group";
import { ThemeModeGroup } from "@/pages/settings/appearance/theme-mode-group";

export function AppearanceStep({
  busy,
  onContinue,
  onBack,
}: {
  busy: boolean;
  onContinue: () => void;
  onBack?: () => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <StepHeader
        title="Deixe o Linvo com a sua cara"
        description="As mudanças aparecem agora e acompanham você nas outras janelas."
      />

      <div className="scrollbar-elegant -mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
        <ThemeModeGroup />
        <AccentGroup />
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
          Continuar
        </StepPrimary>
      </StepActions>
    </section>
  );
}
