import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppearancePreferences } from "@linvo/shared";

import type { WindowLabel } from "@/lib/window-close";

export const APPEARANCE_CHANGED_EVENT = "appearance://changed";

export type AppearanceChangedPayload = {
  prefs: AppearancePreferences;
  origin: WindowLabel;
};

export async function emitAppearanceChanged(
  prefs: AppearancePreferences,
  origin: WindowLabel,
): Promise<void> {
  await emit(APPEARANCE_CHANGED_EVENT, { prefs, origin });
}

/**
 * `emit` é global (chega em todas as janelas, inclusive a que emitiu).
 * Filtramos por `origin` para não reagir ao nosso próprio evento — sem
 * isso, a janela que muda a preferência entraria em loop com ela mesma.
 */
export async function listenAppearanceChanged(
  handler: (prefs: AppearancePreferences) => void,
): Promise<() => void> {
  const currentLabel = getCurrentWindow().label as WindowLabel;

  return listen<AppearanceChangedPayload>(APPEARANCE_CHANGED_EVENT, (event) => {
    if (event.payload.origin === currentLabel) {
      return;
    }
    handler(event.payload.prefs);
  });
}
