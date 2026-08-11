import { useCallback, useEffect, useRef } from "react";
import type { WorkspaceState } from "@linvo/shared";

import * as workspaceApi from "@/lib/workspace/workspace-api";

/** Telas de administração; é onde a mudança de outra pessoa precisa aparecer rápido. */
export const FOREGROUND_POLL_MS = 3_000;
/** Resto do app: continua atualizando, sem gastar 20 requests por minuto. */
export const BACKGROUND_POLL_MS = 15_000;
/** Espelha use-invite-code: só pausa se a janela ficar escondida um tempo. */
const BLUR_PAUSE_MS = 30_000;

export type WorkspaceStateKey = keyof WorkspaceState;

type Handlers = Partial<Record<WorkspaceStateKey, () => void>>;

/**
 * Observa `GET /workspaces/:id/state` e dispara só os handlers das chaves que
 * mudaram desde a última leitura.
 *
 * A primeira resposta apenas registra a linha de base: sem isso todo handler
 * dispararia na montagem, refazendo os fetches que a tela acabou de fazer.
 */
export function useWorkspaceStatePoll(
  workspaceId: string | undefined,
  handlers: Handlers,
  options: { enabled?: boolean; intervalMs?: number } = {},
): { refreshNow: () => Promise<void> } {
  const enabled = options.enabled !== false;
  const intervalMs = options.intervalMs ?? BACKGROUND_POLL_MS;

  const lastSeenRef = useRef<WorkspaceState | null>(null);
  const pausedRef = useRef(false);
  const blurTimerRef = useRef<number | null>(null);
  // Handlers mudam de identidade a cada render do consumidor; guardá-los numa
  // ref evita reiniciar o intervalo (e perder a linha de base) a cada render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const applySnapshot = useCallback((next: WorkspaceState) => {
    const previous = lastSeenRef.current;
    lastSeenRef.current = next;

    if (!previous) {
      return;
    }

    for (const key of Object.keys(next) as WorkspaceStateKey[]) {
      if (previous[key] !== next[key]) {
        handlersRef.current[key]?.();
      }
    }
  }, []);

  const refreshNow = useCallback(async () => {
    if (!workspaceId) return;
    try {
      applySnapshot(await workspaceApi.getWorkspaceState(workspaceId));
    } catch {
      // Uma janela offline não deve derrubar a tela; o próximo tick tenta de novo.
    }
  }, [applySnapshot, workspaceId]);

  // Trocar de workspace invalida a linha de base: as versões são de outro
  // tenant e comparar as duas dispararia todos os handlers de uma vez.
  useEffect(() => {
    lastSeenRef.current = null;
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !enabled) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || pausedRef.current) return;
      try {
        const next = await workspaceApi.getWorkspaceState(workspaceId);
        if (cancelled) return;
        applySnapshot(next);
      } catch {
        return;
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applySnapshot, enabled, intervalMs, workspaceId]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        blurTimerRef.current = window.setTimeout(() => {
          pausedRef.current = true;
        }, BLUR_PAUSE_MS);
        return;
      }

      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }

      if (pausedRef.current) {
        pausedRef.current = false;
        void refreshNow();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, [refreshNow]);

  return { refreshNow };
}
