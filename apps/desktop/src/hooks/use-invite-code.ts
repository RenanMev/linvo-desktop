import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatInviteCode,
  type CreatedWorkspaceInviteCode,
  type WorkspaceInviteCode,
} from "@linvo/shared";

import { AuthApiError } from "@/lib/auth/auth-api";
import * as inviteApi from "@/lib/workspace/invite-api";
import { inviteCopy } from "@/lib/workspace/invite-copy";

export type InviteCodeUiState =
  | "empty"
  | "active"
  | "active-without-value"
  | "redeemed"
  | "expired"
  | "at-capacity";

const POLL_MS = 3_000;
const REDEEMED_HOLD_MS = 60_000;
const BLUR_PAUSE_MS = 30_000;

function remainingMs(expiresAt: string, now: number): number {
  return Math.max(0, new Date(expiresAt).getTime() - now);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function useInviteCode(workspaceId: string | undefined) {
  const [inviteCode, setInviteCode] = useState<WorkspaceInviteCode | null>(
    null,
  );
  const [plaintextCode, setPlaintextCode] = useState<string | null>(null);
  const [uiState, setUiState] = useState<InviteCodeUiState>("empty");
  const [countdown, setCountdown] = useState("0:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atCapacity, setAtCapacity] = useState(false);
  const [redeemerName, setRedeemerName] = useState<string | null>(null);

  const plaintextRef = useRef<string | null>(null);
  const redeemedHoldUntilRef = useRef<number | null>(null);
  const onRedeemedRef = useRef<(() => void) | null>(null);
  const pollingPausedRef = useRef(false);
  const blurTimerRef = useRef<number | null>(null);

  const setPlaintext = useCallback((value: string | null) => {
    plaintextRef.current = value;
    setPlaintextCode(value);
  }, []);

  const applyInviteSnapshot = useCallback(
    (next: WorkspaceInviteCode | null, options?: { keepPlaintext?: boolean }) => {
      const now = Date.now();

      if (
        next?.redeemedAt &&
        redeemedHoldUntilRef.current === null
      ) {
        redeemedHoldUntilRef.current = now + REDEEMED_HOLD_MS;
        setRedeemerName(next.redeemedByName ?? "Alguém");
        setUiState("redeemed");
        setInviteCode(next);
        setPlaintext(null);
        onRedeemedRef.current?.();
        return;
      }

      if (
        redeemedHoldUntilRef.current !== null &&
        now < redeemedHoldUntilRef.current
      ) {
        setUiState("redeemed");
        setInviteCode(next);
        return;
      }

      if (
        redeemedHoldUntilRef.current !== null &&
        now >= redeemedHoldUntilRef.current
      ) {
        redeemedHoldUntilRef.current = null;
        setRedeemerName(null);
      }

      if (!next) {
        setInviteCode(null);
        if (!options?.keepPlaintext) {
          setPlaintext(null);
        }
        setCountdown("0:00");
        setUiState((prev) => {
          if (prev === "expired") {
            return "expired";
          }
          return atCapacity ? "at-capacity" : "empty";
        });
        return;
      }

      const remaining = remainingMs(next.expiresAt, now);
      setInviteCode(next);
      setCountdown(formatCountdown(remaining));

      if (remaining <= 0) {
        setPlaintext(null);
        setUiState("expired");
        return;
      }

      if (plaintextRef.current) {
        setUiState("active");
      } else {
        setUiState("active-without-value");
      }
    },
    [atCapacity, setPlaintext],
  );

  const refreshActive = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const active = await inviteApi.getActiveInviteCode(workspaceId);
      applyInviteSnapshot(active);
    } catch {
      return;
    }
  }, [applyInviteSnapshot, workspaceId]);

  useEffect(() => {
    plaintextRef.current = null;
    setPlaintextCode(null);
    redeemedHoldUntilRef.current = null;
    setRedeemerName(null);
    setError(null);
    setAtCapacity(false);
    setBusy(false);
    setInviteCode(null);
    setUiState("empty");
    if (!workspaceId) return;
    void refreshActive();
  }, [workspaceId, refreshActive]);

  useEffect(() => {
    if (!workspaceId) return;

    const shouldPoll =
      uiState === "active" ||
      uiState === "active-without-value" ||
      uiState === "redeemed";

    if (!shouldPoll) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || pollingPausedRef.current) return;
      try {
        const active = await inviteApi.getActiveInviteCode(workspaceId);
        if (cancelled) return;
        applyInviteSnapshot(active);
      } catch {
        return;
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyInviteSnapshot, uiState, workspaceId]);

  useEffect(() => {
    if (
      uiState !== "active" &&
      uiState !== "active-without-value" &&
      uiState !== "expired"
    ) {
      return;
    }
    if (!inviteCode?.expiresAt) return;

    const tick = () => {
      const remaining = remainingMs(inviteCode.expiresAt, Date.now());
      setCountdown(formatCountdown(remaining));
      if (remaining <= 0) {
        setUiState("expired");
        setPlaintext(null);
        void refreshActive();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [inviteCode?.expiresAt, refreshActive, setPlaintext, uiState]);

  useEffect(() => {
    if (
      uiState !== "redeemed" ||
      redeemedHoldUntilRef.current === null
    ) {
      return;
    }

    const remaining = redeemedHoldUntilRef.current - Date.now();
    const timer = window.setTimeout(() => {
      redeemedHoldUntilRef.current = null;
      setRedeemerName(null);
      setInviteCode(null);
      setPlaintext(null);
      setUiState(atCapacity ? "at-capacity" : "empty");
    }, Math.max(0, remaining));

    return () => window.clearTimeout(timer);
  }, [atCapacity, setPlaintext, uiState]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        blurTimerRef.current = window.setTimeout(() => {
          pollingPausedRef.current = true;
        }, BLUR_PAUSE_MS);
        return;
      }
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
      if (pollingPausedRef.current) {
        pollingPausedRef.current = false;
        void refreshActive();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, [refreshActive]);

  const generate = useCallback(async () => {
    if (!workspaceId || busy || atCapacity) return;
    setBusy(true);
    setError(null);
    try {
      const created: CreatedWorkspaceInviteCode =
        await inviteApi.generateInviteCode(workspaceId);
      const { code, ...withoutCode } = created;
      const formatted = formatInviteCode(code);
      setPlaintext(formatted);
      redeemedHoldUntilRef.current = null;
      setRedeemerName(null);
      applyInviteSnapshot(withoutCode, { keepPlaintext: true });
      setUiState("active");
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 409) {
        setAtCapacity(true);
        setUiState("at-capacity");
        setError(inviteCopy.atCapacity);
      } else if (err instanceof AuthApiError && err.status === 429) {
        setError(inviteCopy.tooManyAttempts);
      } else if (err instanceof AuthApiError && err.status === 403) {
        await refreshActive();
      } else if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível gerar o código");
      }
    } finally {
      setBusy(false);
    }
  }, [
    applyInviteSnapshot,
    atCapacity,
    busy,
    refreshActive,
    setPlaintext,
    workspaceId,
  ]);

  const revoke = useCallback(async () => {
    if (!workspaceId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await inviteApi.revokeInviteCode(workspaceId);
      setPlaintext(null);
      setInviteCode(null);
      setUiState(atCapacity ? "at-capacity" : "empty");
      setCountdown("0:00");
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 403) {
        await refreshActive();
      } else if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível cancelar o código");
      }
    } finally {
      setBusy(false);
    }
  }, [atCapacity, busy, refreshActive, setPlaintext, workspaceId]);

  const markAtCapacity = useCallback((value: boolean) => {
    setAtCapacity(value);
    if (value) {
      setUiState((prev) => (prev === "empty" ? "at-capacity" : prev));
    } else {
      setUiState((prev) => (prev === "at-capacity" ? "empty" : prev));
    }
  }, []);

  const setOnRedeemed = useCallback((handler: (() => void) | null) => {
    onRedeemedRef.current = handler;
  }, []);

  return {
    inviteCode,
    plaintextCode,
    uiState,
    countdown,
    busy,
    error,
    atCapacity,
    redeemerName,
    generate,
    revoke,
    markAtCapacity,
    setOnRedeemed,
    refreshActive,
  };
}
