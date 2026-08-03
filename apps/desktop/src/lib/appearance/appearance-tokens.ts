import {
  APPEARANCE_DEFAULTS,
  appearancePreferencesSchema,
  type AccentColor,
  type AppearancePreferences,
  type BlurLevel,
  type ThemeMode,
  type UiDensity,
} from "@linvo/shared";

export type EffectiveTheme = "light" | "dark";

export type AppearanceEnv = {
  prefersDark: boolean;
  prefersReducedMotion: boolean;
};

export type ResolvedHtmlAttrs = {
  dark: boolean;
  blur: BlurLevel;
  accent: AccentColor;
  reduceMotion: boolean;
};

const PANEL_TINT_RGB: Record<EffectiveTheme, string> = {
  dark: "10, 10, 10",
  light: "250, 249, 248",
};

const EDITORIAL_LEADING_BY_SIZE: Record<15 | 17 | 19, string> = {
  15: "1.75",
  17: "1.7",
  19: "1.65",
};

const DENSITY_VARS: Record<UiDensity, Record<string, string>> = {
  compact: {
    "--chat-message-gap": "1.25rem",
    "--sidebar-row-padding": "0.25rem 0.625rem",
    "--settings-block-padding": "0.75rem",
  },
  comfortable: {
    "--chat-message-gap": "2.25rem",
    "--sidebar-row-padding": "0.375rem 0.625rem",
    "--settings-block-padding": "1rem",
  },
};

function clampPanelOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return APPEARANCE_DEFAULTS.panelOpacity;
  }
  return Math.min(100, Math.max(55, Math.round(value)));
}

/**
 * Sanitiza campo a campo: um enum desconhecido (ex. cliente antigo, API
 * respondendo um valor que este build não conhece) cai no default daquele
 * campo isoladamente — os demais campos válidos são preservados.
 */
export function sanitizePreferences(
  prefs: Partial<AppearancePreferences> | null | undefined,
): AppearancePreferences {
  const merged = { ...APPEARANCE_DEFAULTS, ...prefs, updatedAt: prefs?.updatedAt };
  const parsed = appearancePreferencesSchema.safeParse({
    ...merged,
    updatedAt: merged.updatedAt ?? new Date().toISOString(),
  });

  if (parsed.success) {
    return parsed.data;
  }

  const safe: AppearancePreferences = {
    ...APPEARANCE_DEFAULTS,
    updatedAt: new Date().toISOString(),
  };

  const candidate = prefs ?? {};
  for (const key of Object.keys(APPEARANCE_DEFAULTS) as Array<
    keyof typeof APPEARANCE_DEFAULTS
  >) {
    const fieldSchema = appearancePreferencesSchema.shape[key];
    const value = candidate[key];
    const fieldResult = fieldSchema.safeParse(value);
    if (fieldResult.success) {
      (safe as Record<string, unknown>)[key] = fieldResult.data;
    }
  }

  if (typeof candidate.panelOpacity === "number") {
    safe.panelOpacity = clampPanelOpacity(candidate.panelOpacity);
  }

  return safe;
}

export function resolveEffectiveTheme(
  mode: ThemeMode,
  prefersDark: boolean,
): EffectiveTheme {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function resolveHtmlAttrs(
  prefs: AppearancePreferences,
  effectiveTheme: EffectiveTheme,
  prefersReducedMotion: boolean,
): ResolvedHtmlAttrs {
  return {
    dark: effectiveTheme === "dark",
    blur: prefs.blurLevel,
    accent: prefs.accentColor,
    reduceMotion: prefs.reduceMotion ?? prefersReducedMotion,
  };
}

export function resolveCssVars(
  prefs: AppearancePreferences,
  effectiveTheme: EffectiveTheme,
): Record<string, string> {
  const opacity = clampPanelOpacity(prefs.panelOpacity) / 100;
  const editorialFontFamily =
    prefs.responseFont === "serif" ? "var(--font-editorial)" : "var(--font-interface)";

  return {
    "--panel-tint": `rgba(${PANEL_TINT_RGB[effectiveTheme]}, ${opacity})`,
    "--editorial-font-family": editorialFontFamily,
    "--editorial-size": `${prefs.responseFontSize}px`,
    "--editorial-leading": EDITORIAL_LEADING_BY_SIZE[prefs.responseFontSize],
    ...DENSITY_VARS[prefs.uiDensity],
  };
}

export function applyAppearance(
  root: HTMLElement,
  prefs: AppearancePreferences,
  env: AppearanceEnv,
): void {
  const safePrefs = sanitizePreferences(prefs);
  const effectiveTheme = resolveEffectiveTheme(safePrefs.themeMode, env.prefersDark);
  const attrs = resolveHtmlAttrs(safePrefs, effectiveTheme, env.prefersReducedMotion);

  root.classList.toggle("dark", attrs.dark);
  root.setAttribute("data-blur", attrs.blur);
  root.setAttribute("data-accent", attrs.accent);
  root.setAttribute("data-reduce-motion", String(attrs.reduceMotion));

  const vars = resolveCssVars(safePrefs, effectiveTheme);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
