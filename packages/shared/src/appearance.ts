import { z } from "zod";

export const themeModeSchema = z.enum(["system", "light", "dark"]);

export const blurLevelSchema = z.enum(["off", "light", "medium", "strong"]);

export const accentColorSchema = z.enum([
  "purple",
  "graphite",
  "blue",
  "green",
  "amber",
  "rose",
  "custom",
]);

export const DEFAULT_CUSTOM_ACCENT_RGBA = "rgba(124, 58, 237, 1)";

const CUSTOM_ACCENT_RGBA_RE =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i;

export function isValidCustomAccentRgba(value: string): boolean {
  const match = CUSTOM_ACCENT_RGBA_RE.exec(value);
  if (!match) {
    return false;
  }
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = Number(match[4]);
  return (
    Number.isFinite(r) &&
    Number.isFinite(g) &&
    Number.isFinite(b) &&
    Number.isFinite(a) &&
    r >= 0 &&
    r <= 255 &&
    g >= 0 &&
    g <= 255 &&
    b >= 0 &&
    b <= 255 &&
    a >= 0 &&
    a <= 1
  );
}

export const customAccentRgbaSchema = z
  .string()
  .refine(isValidCustomAccentRgba, { message: "Invalid rgba color" });

export const responseFontSchema = z.enum(["serif", "interface"]);

export const uiDensitySchema = z.enum(["compact", "comfortable"]);

export const responseFontSizeSchema = z.union([
  z.literal(15),
  z.literal(17),
  z.literal(19),
]);

export const appearancePreferencesSchema = z.object({
  themeMode: themeModeSchema,
  panelOpacity: z.number().int().min(55).max(100),
  blurLevel: blurLevelSchema,
  accentColor: accentColorSchema,
  customAccentRgba: customAccentRgbaSchema.default(DEFAULT_CUSTOM_ACCENT_RGBA),
  responseFont: responseFontSchema,
  responseFontSize: responseFontSizeSchema,
  uiDensity: uiDensitySchema,
  reduceMotion: z.boolean().nullable(),
  updatedAt: z.string().datetime(),
});

export const updateAppearancePreferencesSchema = appearancePreferencesSchema
  .omit({ updatedAt: true })
  .partial();

export const APPEARANCE_DEFAULTS = {
  themeMode: "system",
  panelOpacity: 72,
  blurLevel: "medium",
  accentColor: "purple",
  customAccentRgba: DEFAULT_CUSTOM_ACCENT_RGBA,
  responseFont: "serif",
  responseFontSize: 17,
  uiDensity: "comfortable",
  reduceMotion: null,
} as const;

export type ThemeMode = z.infer<typeof themeModeSchema>;
export type BlurLevel = z.infer<typeof blurLevelSchema>;
export type AccentColor = z.infer<typeof accentColorSchema>;
export type ResponseFont = z.infer<typeof responseFontSchema>;
export type UiDensity = z.infer<typeof uiDensitySchema>;
export type ResponseFontSize = z.infer<typeof responseFontSizeSchema>;
export type AppearancePreferences = z.infer<typeof appearancePreferencesSchema>;
export type UpdateAppearancePreferencesInput = z.infer<
  typeof updateAppearancePreferencesSchema
>;
