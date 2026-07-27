import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  APPEARANCE_DEFAULTS,
  type AppearancePreferences,
  type UpdateAppearancePreferencesInput,
} from "@linvo/shared";

import * as appearanceApi from "@/lib/appearance/appearance-api";
import {
  applyAppearance,
  sanitizePreferences,
  type AppearanceEnv,
} from "@/lib/appearance/appearance-tokens";
import {
  clearStoredAppearance,
  hasPendingSync,
  loadStoredAppearance,
  markPendingSync,
  saveStoredAppearance,
} from "@/lib/appearance/appearance-store";
import { syncPanelNativeBlur } from "@/lib/appearance/appearance-native";
import {
  emitAppearanceChanged,
  listenAppearanceChanged,
} from "@/lib/appearance/appearance-sync";
import { listenAuthSync, listenTokenSync } from "@/lib/auth-sync";
import type { WindowLabel } from "@/lib/window-close";

const PATCH_DEBOUNCE_MS = 400;

type AppearanceContextValue = {
  preferences: AppearancePreferences;
  setPreference: <K extends keyof UpdateAppearancePreferencesInput>(
    key: K,
    value: NonNullable<UpdateAppearancePreferencesInput[K]>,
  ) => void;
  resetToDefaults: () => void;
  isSyncing: boolean;
};

const AppearanceReactContext = createContext<AppearanceContextValue | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function readEnv(): AppearanceEnv {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return { prefersDark: false, prefersReducedMotion: false };
  }
  return {
    prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
  };
}

function isNewer(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

export function AppearanceProvider({
  children,
  windowLabel,
  readOnly = false,
}: {
  children: ReactNode;
  windowLabel: WindowLabel;
  readOnly?: boolean;
}) {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => {
    const stored = loadStoredAppearance();
    return stored?.prefs ?? sanitizePreferences(null);
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [reconciliationTrigger, setReconciliationTrigger] = useState(0);

  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<UpdateAppearancePreferencesInput>({});
  const patchInFlightRef = useRef(false);
  const patchRunnerRef = useRef<() => void>(() => undefined);
  const localRevisionRef = useRef(0);
  const sessionEpochRef = useRef(0);
  const reconciliationRef = useRef(0);

  const applyAndPersist = useCallback((next: AppearancePreferences) => {
    applyAppearance(document.documentElement, next, readEnv());
    saveStoredAppearance(next);
    setPreferences(next);
  }, []);

  const resetSignedOutAppearance = useCallback(() => {
    sessionEpochRef.current += 1;
    localRevisionRef.current += 1;
    reconciliationRef.current += 1;

    if (patchTimerRef.current) {
      clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
    }
    pendingPatchRef.current = {};

    clearStoredAppearance();
    const defaults = {
      ...APPEARANCE_DEFAULTS,
      updatedAt: nowIso(),
    };
    applyAppearance(document.documentElement, defaults, readEnv());
    setPreferences(defaults);

    if (!patchInFlightRef.current) {
      setIsSyncing(false);
    }
  }, []);

  useEffect(
    () => () => {
      sessionEpochRef.current += 1;
      reconciliationRef.current += 1;
      if (patchTimerRef.current) {
        clearTimeout(patchTimerRef.current);
      }
    },
    [],
  );

  // Aplica no boot — idempotente com o script inline do index.html (C6),
  // que já pintou a tela antes do primeiro paint. Reage a mudanças ao vivo
  // do tema do SO quando themeMode === "system".
  useEffect(() => {
    applyAppearance(document.documentElement, prefsRef.current, readEnv());

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (prefsRef.current.themeMode === "system") {
        applyAppearance(document.documentElement, prefsRef.current, readEnv());
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Reconciliação com o servidor: só quem não é readOnly (o painel) fala
  // com a API. Bar e checklist só leem o local storage e escutam broadcast.
  useEffect(() => {
    if (readOnly) {
      return;
    }

    let cancelled = false;
    const localRevision = localRevisionRef.current;
    const sessionEpoch = sessionEpochRef.current;
    const reconciliation = ++reconciliationRef.current;

    void (async () => {
      try {
        const server = await appearanceApi.fetchAppearance();
        if (
          cancelled ||
          reconciliation !== reconciliationRef.current ||
          localRevision !== localRevisionRef.current ||
          sessionEpoch !== sessionEpochRef.current
        ) {
          return;
        }

        const stored = loadStoredAppearance();
        const localIsNewer =
          stored != null &&
          (hasPendingSync() || isNewer(stored.prefs.updatedAt, server.updatedAt));

        if (localIsNewer && stored) {
          applyAndPersist(stored.prefs);
          const { updatedAt: _updatedAt, ...input } = stored.prefs;
          pendingPatchRef.current = {
            ...input,
            ...pendingPatchRef.current,
          };
          markPendingSync(true);
          patchRunnerRef.current();
        } else {
          applyAndPersist(server);
          markPendingSync(false);
          void emitAppearanceChanged(server, windowLabel);
        }
      } catch {
        // Offline no boot: fica com o que já foi aplicado do local/defaults.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAndPersist, readOnly, reconciliationTrigger, windowLabel]);

  // Blur nativo (acrylic) atrás do painel: o CSS sozinho não borra o que
  // está atrás da janela transparente. Reaplica quando o nível muda.
  useEffect(() => {
    if (windowLabel !== "panel") {
      return;
    }
    void syncPanelNativeBlur(preferences.blurLevel);
  }, [windowLabel, preferences.blurLevel]);

  // Broadcast das outras janelas (ver appearance-sync.ts — já filtra eco).
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;

    void listenAppearanceChanged((next) => {
      localRevisionRef.current += 1;
      applyAndPersist(next);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      dispose = fn;
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [applyAndPersist]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;

    void listenAuthSync(
      () => {
        resetSignedOutAppearance();
      },
      { includeSelf: true },
    ).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      dispose = fn;
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [resetSignedOutAppearance]);

  useEffect(() => {
    if (readOnly) {
      return;
    }

    let dispose: (() => void) | undefined;
    let cancelled = false;

    void listenTokenSync(() => {
      setReconciliationTrigger((current) => current + 1);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      dispose = fn;
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [readOnly]);

  const flushPatch = useCallback(() => {
    if (readOnly || patchInFlightRef.current) {
      return;
    }

    if (patchTimerRef.current) {
      clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
    }

    const input = pendingPatchRef.current;
    if (Object.keys(input).length === 0) {
      setIsSyncing(false);
      return;
    }
    pendingPatchRef.current = {};

    const localRevision = localRevisionRef.current;
    const sessionEpoch = sessionEpochRef.current;
    patchInFlightRef.current = true;
    setIsSyncing(true);
    let shouldContinue = false;

    appearanceApi
      .patchAppearance(input)
      .then((patched) => {
        if (sessionEpoch !== sessionEpochRef.current) {
          return;
        }

        const hasNewerPatch =
          Object.keys(pendingPatchRef.current).length > 0;
        shouldContinue = hasNewerPatch;

        if (
          localRevision === localRevisionRef.current &&
          !hasNewerPatch
        ) {
          applyAndPersist(patched);
          void emitAppearanceChanged(patched, windowLabel);
        }
        if (!hasNewerPatch) {
          markPendingSync(false);
        }
      })
      .catch(() => {
        if (sessionEpoch !== sessionEpochRef.current) {
          return;
        }

        const hasNewerPatch =
          Object.keys(pendingPatchRef.current).length > 0;
        pendingPatchRef.current = {
          ...input,
          ...pendingPatchRef.current,
        };
        shouldContinue = hasNewerPatch;
        markPendingSync(true);
      })
      .finally(() => {
        patchInFlightRef.current = false;

        if (sessionEpoch !== sessionEpochRef.current) {
          if (Object.keys(pendingPatchRef.current).length > 0) {
            queueMicrotask(() => patchRunnerRef.current());
          } else {
            setIsSyncing(false);
          }
          return;
        }

        if (shouldContinue) {
          queueMicrotask(() => patchRunnerRef.current());
        } else {
          setIsSyncing(false);
        }
      });
  }, [applyAndPersist, readOnly, windowLabel]);
  patchRunnerRef.current = flushPatch;

  const setPreference = useCallback(
    <K extends keyof UpdateAppearancePreferencesInput>(
      key: K,
      value: NonNullable<UpdateAppearancePreferencesInput[K]>,
    ) => {
      localRevisionRef.current += 1;
      const next: AppearancePreferences = {
        ...prefsRef.current,
        [key]: value,
        updatedAt: nowIso(),
      };

      applyAndPersist(next);
      void emitAppearanceChanged(next, windowLabel);

      if (!readOnly) {
        pendingPatchRef.current = { ...pendingPatchRef.current, [key]: value };
        markPendingSync(true);
        if (patchTimerRef.current) {
          clearTimeout(patchTimerRef.current);
        }
        patchTimerRef.current = setTimeout(flushPatch, PATCH_DEBOUNCE_MS);
      }
    },
    [applyAndPersist, flushPatch, readOnly, windowLabel],
  );

  const resetToDefaults = useCallback(() => {
    localRevisionRef.current += 1;
    const next: AppearancePreferences = {
      ...APPEARANCE_DEFAULTS,
      updatedAt: nowIso(),
    };
    applyAndPersist(next);
    void emitAppearanceChanged(next, windowLabel);

    if (readOnly) {
      return;
    }

    if (patchTimerRef.current) {
      clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
    }
    pendingPatchRef.current = { ...APPEARANCE_DEFAULTS };
    markPendingSync(true);
    flushPatch();
  }, [applyAndPersist, flushPatch, readOnly, windowLabel]);

  const value = useMemo(
    () => ({ preferences, setPreference, resetToDefaults, isSyncing }),
    [preferences, setPreference, resetToDefaults, isSyncing],
  );

  return (
    <AppearanceReactContext.Provider value={value}>
      {children}
    </AppearanceReactContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceReactContext);
  if (!ctx) {
    throw new Error("useAppearance deve ser usado dentro de AppearanceProvider");
  }
  return ctx;
}
