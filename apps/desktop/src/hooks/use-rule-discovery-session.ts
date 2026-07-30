import { useCallback, useEffect, useRef, useState } from "react";
import type { RuleDiscoverySessionDetail } from "@linvo/shared";

import * as ruleDiscoveryApi from "@/lib/workspace/rule-discovery-api";

const POLL_INTERVAL_MS = 2_000;
const POLLING_STATUSES = new Set(["PENDING", "PROCESSING"]);

export type RuleDiscoverySessionController = {
  session: RuleDiscoverySessionDetail | null;
  start: (files: File[]) => Promise<void>;
  refresh: () => Promise<RuleDiscoverySessionDetail | null>;
  isPolling: boolean;
  error: string | null;
};

/**
 * O polling só existe enquanto este hook está montado — sair do passo de
 * Conhecimento (unmount) para o polling sem cancelar a sessão no servidor.
 * `initialSessionId` permite retomar: se o usuário volta ao passo, um
 * `getSession` imediato traz o estado atual antes do próximo tick.
 */
export function useRuleDiscoverySession(
  workspaceId: string | null,
  initialSessionId?: string | null,
  enabled = true,
): RuleDiscoverySessionController {
  const [session, setSession] = useState<RuleDiscoverySessionDetail | null>(
    null,
  );
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);
  const wasEnabledRef = useRef(enabled);

  const start = useCallback(
    async (files: File[]) => {
      if (!workspaceId) {
        return;
      }
      setError(null);
      try {
        const created = await ruleDiscoveryApi.createSession(
          workspaceId,
          files,
        );
        sessionIdRef.current = created.id;
        setSession(created);
      } catch {
        setError("Não foi possível enviar os documentos");
      }
    },
    [workspaceId],
  );

  const refresh = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!workspaceId || !sessionId) {
      return null;
    }
    try {
      const detail = await ruleDiscoveryApi.getSession(workspaceId, sessionId);
      setSession(detail);
      setError(null);
      return detail;
    } catch {
      setError("Não foi possível carregar a sessão");
      return null;
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!enabled || !workspaceId || !initialSessionId) {
      return;
    }
    let cancelled = false;
    sessionIdRef.current = initialSessionId;

    void ruleDiscoveryApi
      .getSession(workspaceId, initialSessionId)
      .then((detail) => {
        if (!cancelled) {
          setSession(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar a sessão");
        }
      });

    return () => {
      cancelled = true;
    };
    // Só roda uma vez no mount — retomar o passo é um refetch único, não um loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, initialSessionId, workspaceId]);

  useEffect(() => {
    const wasEnabled = wasEnabledRef.current;
    wasEnabledRef.current = enabled;
    const sessionId = sessionIdRef.current;
    if (
      !enabled ||
      wasEnabled ||
      !workspaceId ||
      !sessionId ||
      initialSessionId
    ) {
      return;
    }

    let cancelled = false;
    void ruleDiscoveryApi
      .getSession(workspaceId, sessionId)
      .then((detail) => {
        if (!cancelled) {
          setSession(detail);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar a sessão");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, initialSessionId, workspaceId]);

  useEffect(() => {
    if (
      !enabled ||
      !workspaceId ||
      !session ||
      !POLLING_STATUSES.has(session.status)
    ) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let cancelled = false;
    const activeSessionId = session.id;

    const timer = window.setInterval(() => {
      void ruleDiscoveryApi
        .getSession(workspaceId, activeSessionId)
        .then((detail) => {
          if (cancelled) {
            return;
          }
          setSession(detail);
          setError(null);
        })
        .catch(() => {
          if (!cancelled) {
            window.clearInterval(timer);
            setIsPolling(false);
            setError("Não foi possível atualizar o progresso");
          }
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, workspaceId, session?.id, session?.status]);

  return { session, start, refresh, isPolling, error };
}
