import type { AppearancePreferences } from "@linvo/shared";

import {
  resolveEffectiveTheme,
  resolveHtmlAttrs,
  sanitizePreferences,
  type AppearanceEnv,
  type ResolvedHtmlAttrs,
} from "@/lib/appearance/appearance-tokens";

export type BootEnv = AppearanceEnv;

/** Precisa bater com APPEARANCE_STORAGE_VERSION em appearance-store.ts. */
const APPEARANCE_STORAGE_VERSION = 1;

/**
 * Decisão de boot pura: dado o conteúdo bruto da chave de localStorage
 * (string ou null se ausente/indisponível) e o sinal do SO, resolve o
 * que aplicar no `<html>` antes do primeiro paint.
 *
 * É a referência testável com a qual o script inline em `index.html`
 * precisa se manter em sincronia manual — aquele script não pode
 * importar este módulo (roda antes de qualquer bundle carregar), então
 * duplica só o essencial em JS puro. Qualquer mudança de regra aqui
 * precisa ser replicada lá.
 */
export function computeBootAttrs(
  rawEnvelope: string | null,
  env: BootEnv,
): ResolvedHtmlAttrs {
  const prefs = parseEnvelopePrefs(rawEnvelope);
  const effectiveTheme = resolveEffectiveTheme(prefs.themeMode, env.prefersDark);
  return resolveHtmlAttrs(prefs, effectiveTheme, env.prefersReducedMotion);
}

function parseEnvelopePrefs(rawEnvelope: string | null): AppearancePreferences {
  if (!rawEnvelope) {
    return sanitizePreferences(null);
  }

  try {
    const parsed = JSON.parse(rawEnvelope) as {
      version?: unknown;
      prefs?: unknown;
    };

    if (parsed.version !== APPEARANCE_STORAGE_VERSION) {
      return sanitizePreferences(null);
    }

    return sanitizePreferences(
      parsed.prefs as Partial<AppearancePreferences> | undefined,
    );
  } catch {
    return sanitizePreferences(null);
  }
}
