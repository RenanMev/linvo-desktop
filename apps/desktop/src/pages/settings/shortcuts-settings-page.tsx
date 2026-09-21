import { useEffect, useState, type KeyboardEvent } from "react";
import { Keyboard } from "lucide-react";

import {
  SettingsHeader,
  SettingsPage,
  SettingsSection,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PUSH_TO_TALK_SHORTCUT,
  FALLBACK_PUSH_TO_TALK_SHORTCUT,
  formatShortcut,
  getStoredPushToTalkShortcut,
  isReservedShortcut,
  isValidShortcut,
  setStoredPushToTalkShortcut,
  shortcutFromKeyboardEvent,
  subscribePushToTalkShortcut,
} from "@/lib/voice/push-to-talk-shortcut";

const FIXED_SHORTCUTS = [
  { keys: "CommandOrControl+Shift+L", label: "Mostrar ou ocultar o Assist" },
  { keys: "CommandOrControl+Shift+C", label: "Capturar a tela e perguntar" },
  { keys: "Enter", label: "Abrir o chat com a pílula focada" },
  { keys: "Esc", label: "Fechar o Assist" },
] as const;

function ShortcutKeys({ keys }: { keys: string }) {
  return (
    <kbd className="rounded-md border border-hairline bg-surface-raise-2 px-1.5 py-0.5 font-technical text-[11px] text-foreground">
      {formatShortcut(keys)}
    </kbd>
  );
}

/**
 * Configurações › Atalhos (KAN-42).
 *
 * Só o push-to-talk é editável — os outros continuam fixos. Capturar a
 * combinação: focar o campo e pressionar as teclas. A preferência fica no
 * localStorage; a barra escuta e re-registra o atalho global na hora.
 */
export function ShortcutsSettingsPage() {
  const [shortcut, setShortcut] = useState(getStoredPushToTalkShortcut);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribePushToTalkShortcut(() => {
        setShortcut(getStoredPushToTalkShortcut());
      }),
    [],
  );

  function handleCaptureKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!capturing) {
      return;
    }
    event.preventDefault();
    if (event.key === "Escape") {
      setCapturing(false);
      setError(null);
      return;
    }
    const next = shortcutFromKeyboardEvent(event);
    if (!next) {
      // Só modificador ainda, ou tecla que não vira atalho global.
      return;
    }
    if (isReservedShortcut(next)) {
      setError(`${formatShortcut(next)} já é usado pelo Linvo.`);
      return;
    }
    if (!isValidShortcut(next)) {
      setError("Use um modificador (Ctrl, Alt, Shift) mais uma tecla.");
      return;
    }
    setStoredPushToTalkShortcut(next);
    setShortcut(next);
    setCapturing(false);
    setError(null);
  }

  function handleReset() {
    setStoredPushToTalkShortcut(null);
    setShortcut(DEFAULT_PUSH_TO_TALK_SHORTCUT);
    setCapturing(false);
    setError(null);
  }

  return (
    <SettingsPage className="max-w-2xl">
      <SettingsHeader
        title="Atalhos"
        description="Teclas que funcionam com o Linvo em segundo plano, enquanto você atende."
      />

      <SettingsSection
        title="Segurar para falar"
        description="Segure o atalho, fale, solte. O texto entra no composer do Assist para você revisar antes de enviar."
      >
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-raise-1 px-3 py-2.5">
          <Keyboard className="size-4 shrink-0 text-text-tertiary" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Push-to-talk</p>
            <p className="text-xs text-muted-foreground">
              Se {formatShortcut(shortcut)} estiver ocupado por outro programa, o
              Linvo usa {formatShortcut(FALLBACK_PUSH_TO_TALK_SHORTCUT)}.
            </p>
          </div>
          <Button
            type="button"
            variant={capturing ? "default" : "outline"}
            size="sm"
            aria-label={
              capturing
                ? "Pressione a nova combinação"
                : `Atalho atual ${formatShortcut(shortcut)}; clique para alterar`
            }
            onClick={() => {
              setCapturing((current) => !current);
              setError(null);
            }}
            onKeyDown={handleCaptureKeyDown}
            onBlur={() => setCapturing(false)}
            className="font-technical text-xs"
          >
            {capturing ? "Pressione as teclas…" : formatShortcut(shortcut)}
          </Button>
          {shortcut !== DEFAULT_PUSH_TO_TALK_SHORTCUT ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              Padrão
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Fixos"
        description="Estes não mudam nesta versão."
      >
        <ul className="divide-y divide-hairline rounded-lg border border-hairline bg-surface-raise-1">
          {FIXED_SHORTCUTS.map((item) => (
            <li
              key={item.keys}
              className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <ShortcutKeys keys={item.keys} />
            </li>
          ))}
        </ul>
      </SettingsSection>
    </SettingsPage>
  );
}
