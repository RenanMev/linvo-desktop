import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

import { SettingsSelect } from "@/components/settings/settings-select";
import { SettingsSwitch } from "@/components/settings/settings-switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  hydrateDesktopSettings,
  loadHideFromCapture,
  saveHideFromCapture,
} from "@/lib/desktop-settings-store";
import { islandLog } from "@/lib/island-debug";
import { overlayChromeStatus, setExcludeFromCapture } from "@/lib/overlay-chrome";
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
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [hideFromCapture, setHideFromCapture] = useState(false);
  const [nativeUnavailable, setNativeUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const enabled = await isEnabled();
        if (!cancelled) {
          setOpenAtLogin(enabled);
        }
      } catch (error) {
        islandLog("settings:autostart:isEnabled:FAILED", {
          error: String(error),
        });
      }

      await hydrateDesktopSettings();
      if (!cancelled) {
        setHideFromCapture(loadHideFromCapture());
      }

      const status = await overlayChromeStatus();
      if (!cancelled && status && !status.win32Ok) {
        setNativeUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleReviewOnboarding() {
    await requestOnboardingReview();
    await closePanel();
  }

  async function handleOpenAtLoginChange(next: boolean) {
    const previous = openAtLogin;
    setOpenAtLogin(next);
    try {
      if (next) {
        await enable();
      } else {
        await disable();
      }
    } catch (error) {
      islandLog("settings:autostart:toggle:FAILED", { error: String(error) });
      setOpenAtLogin(previous);
    }
  }

  async function handleHideFromCaptureChange(next: boolean) {
    const previous = hideFromCapture;
    setHideFromCapture(next);
    try {
      await saveHideFromCapture(next);
      await setExcludeFromCapture(next);
    } catch (error) {
      islandLog("settings:hideFromCapture:toggle:FAILED", {
        error: String(error),
      });
      setHideFromCapture(previous);
    }
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
          <SettingsSwitch
            label="Abrir com o Windows"
            description="O assistente fica disponível depois do login."
            checked={openAtLogin}
            onCheckedChange={(next) => void handleOpenAtLoginChange(next)}
          />
          <SettingsSwitch
            label="Ocultar Linvo ao compartilhar tela"
            description="Some do Meet e do Teams. A captura do próprio Linvo continua funcionando."
            checked={hideFromCapture}
            onCheckedChange={(next) => void handleHideFromCaptureChange(next)}
          />
          {nativeUnavailable ? (
            <p className="px-1 text-[11px] text-muted-foreground">
              Algumas funções nativas da ilha não estão disponíveis neste Windows.
            </p>
          ) : null}
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
