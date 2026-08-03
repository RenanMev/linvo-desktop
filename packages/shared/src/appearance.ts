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
]);

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
