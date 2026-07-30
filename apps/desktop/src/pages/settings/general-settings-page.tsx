import { useState } from "react";

import { SettingsSelect } from "@/components/settings/settings-select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { requestOnboardingReview } from "@/lib/onboarding-review-sync";
import { closePanel } from "@/lib/panel-window";

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]["value"];

export function GeneralSettingsPage() {
  const [systemLanguage, setSystemLanguage] = useState<LanguageValue>("pt-BR");
  const [responseLanguage, setResponseLanguage] =
    useState<LanguageValue>("pt-BR");

  async function handleReviewOnboarding() {
    await requestOnboardingReview();
    await closePanel();
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Geral</h1>
          <p className="text-xs text-muted-foreground">
            Preferências gerais do assistente.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <SettingsSelect
            label="Idioma do sistema"
            description="Define o idioma da interface do Linvo."
            value={systemLanguage}
            options={LANGUAGE_OPTIONS}
            onChange={setSystemLanguage}
          />
          <SettingsSelect
            label="Idioma padrão de resposta"
            description="Idioma preferido para as respostas do assistente."
            value={responseLanguage}
            options={LANGUAGE_OPTIONS}
            onChange={setResponseLanguage}
          />
          <div className="rounded-xl border border-hairline bg-muted/40 p-3">
            <p className="text-xs font-medium">Atalho global</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Use Ctrl+Shift+L para mostrar ou ocultar a barra flutuante.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-muted/40 p-3">
            <div>
              <p className="text-xs font-medium">Onboarding</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Reveja a configuração inicial sem reiniciar o aplicativo.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleReviewOnboarding()}
            >
              Rever onboarding
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
