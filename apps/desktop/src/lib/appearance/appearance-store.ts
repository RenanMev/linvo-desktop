import { appearancePreferencesSchema, type AppearancePreferences } from "@linvo/shared";

export const APPEARANCE_STORAGE_KEY = "linvo:appearance";
const APPEARANCE_STORAGE_VERSION = 1;

export type StoredAppearance = {
  version: typeof APPEARANCE_STORAGE_VERSION;
  prefs: AppearancePreferences;
  pendingSync: boolean;
};

function readEnvelope(): StoredAppearance | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== APPEARANCE_STORAGE_VERSION
  ) {
    return null;
  }

  const prefsResult = appearancePreferencesSchema.safeParse(
    (parsed as { prefs?: unknown }).prefs,
  );
  if (!prefsResult.success) {
    return null;
  }

  return {
    version: APPEARANCE_STORAGE_VERSION,
    prefs: prefsResult.data,
    pendingSync: Boolean((parsed as { pendingSync?: unknown }).pendingSync),
  };
}

function writeEnvelope(envelope: StoredAppearance): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(envelope));
}

export function loadStoredAppearance(): StoredAppearance | null {
  return readEnvelope();
}

export function saveStoredAppearance(prefs: AppearancePreferences): void {
  const existing = readEnvelope();
  writeEnvelope({
    version: APPEARANCE_STORAGE_VERSION,
    prefs,
    pendingSync: existing?.pendingSync ?? false,
  });
}

export function clearStoredAppearance(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(APPEARANCE_STORAGE_KEY);
}

export function markPendingSync(pending: boolean): void {
  const existing = readEnvelope();
  if (!existing) {
    return;
  }
  writeEnvelope({ ...existing, pendingSync: pending });
}

export function hasPendingSync(): boolean {
  return readEnvelope()?.pendingSync ?? false;
}
