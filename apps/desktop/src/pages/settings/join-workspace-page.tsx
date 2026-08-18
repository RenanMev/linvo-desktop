import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  formatInviteCode,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
} from "@linvo/shared";

import {
  SettingsBack,
  SettingsError,
  SettingsHeader,
  SettingsPage,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/context/workspace-context";
import { AuthApiError } from "@/lib/auth/auth-api";
import { inviteCopy } from "@/lib/workspace/invite-copy";
import * as inviteApi from "@/lib/workspace/invite-api";

export function JoinWorkspacePage() {
  const navigate = useNavigate();
  const { applyRedeemedWorkspace } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawCode, setRawCode] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockRemaining, setLockRemaining] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (lockedUntil === null) {
      setLockRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, lockedUntil - Date.now());
      setLockRemaining(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const normalized = normalizeInviteCode(rawCode);
  const canSubmit =
    normalized.length === INVITE_CODE_LENGTH && !busy && lockRemaining <= 0;

  function applyRaw(nextRaw: string) {
    const next = normalizeInviteCode(nextRaw);
    setRawCode(next);
    setDisplayValue(formatInviteCode(next));
  }

  async function handleSubmit(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await inviteApi.redeemInviteCode(normalized);
      await applyRedeemedWorkspace(result.workspace);
      if (result.alreadyMember) {
        setInfo(inviteCopy.alreadyMember(result.workspace.name));
        await new Promise((resolve) => {
          window.setTimeout(resolve, 1200);
        });
      }
      navigate("/chat");
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429) {
        setError(inviteCopy.tooManyAttempts);
        setLockedUntil(Date.now() + 60_000);
      } else if (err instanceof AuthApiError && err.status === 409) {
        setError(inviteCopy.atCapacity);
      } else if (err instanceof AuthApiError && err.status === 400) {
        setError(err.message || inviteCopy.redeemError);
      } else if (err instanceof AuthApiError) {
        setError(err.message || inviteCopy.redeemError);
      } else {
        setError(inviteCopy.redeemError);
      }
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage className="max-w-md">
      <div className="space-y-5">
        <SettingsBack onClick={() => navigate("/settings/workspace")} />
        <SettingsHeader
          title={inviteCopy.joinTitle}
          description={inviteCopy.joinHint}
        />
      </div>

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block space-y-2">
          <span className="text-sm font-medium">{inviteCopy.joinField}</span>
          <Input
            ref={inputRef}
            value={displayValue}
            autoComplete="off"
            spellCheck={false}
            disabled={busy || lockRemaining > 0}
            placeholder="XXXX-XXXX"
            aria-label={inviteCopy.joinField}
            className="h-11 font-technical text-sm uppercase tracking-[0.18em]"
            aria-invalid={Boolean(error)}
            onChange={(event) => applyRaw(event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              applyRaw(event.clipboardData.getData("text"));
            }}
          />
        </label>

        {error ? <SettingsError message={error} /> : null}
        {info ? (
          <p role="status" className="text-[13px] text-muted-foreground">
            {info}
          </p>
        ) : null}

        <Button type="submit" disabled={!canSubmit} className="w-full" size="lg">
          {busy ? "Entrando..." : inviteCopy.joinButton}
        </Button>
      </form>
    </SettingsPage>
  );
}
