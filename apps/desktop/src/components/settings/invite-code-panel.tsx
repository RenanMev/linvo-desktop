import { useEffect, useState } from "react";
import { formatInviteCode } from "@linvo/shared";

import { Button } from "@/components/ui/button";
import type { useInviteCode } from "@/hooks/use-invite-code";
import { writeClipboardText } from "@/lib/clipboard";
import { inviteCopy } from "@/lib/workspace/invite-copy";

type InviteCodeController = ReturnType<typeof useInviteCode>;

export function InviteCodePanel({
  invite,
}: {
  invite: InviteCodeController;
}) {
  const {
    plaintextCode,
    uiState,
    countdown,
    busy,
    error,
    atCapacity,
    redeemerName,
    generate,
    revoke,
  } = invite;

  const [copied, setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    setConfirmCancel(false);
  }, [uiState, plaintextCode]);

  async function handleCopy() {
    if (!plaintextCode) return;
    const value = formatInviteCode(plaintextCode);
    const ok = await writeClipboardText(value);
    if (ok) {
      setCopied(true);
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-surface-raise-1 px-3 py-3">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium">{inviteCopy.joinField}</p>
        {uiState === "empty" ? (
          <p className="text-[12px] text-muted-foreground">
            {inviteCopy.generateHint}
          </p>
        ) : null}
        {uiState === "active" || uiState === "active-without-value" ? (
          <p className="text-[12px] text-muted-foreground">
            {inviteCopy.generateWillInvalidate}
          </p>
        ) : null}
      </div>

      {uiState === "active" && plaintextCode ? (
        <div className="space-y-3">
          <p
            role="status"
            className="font-technical text-2xl font-medium tracking-[0.18em] text-foreground"
          >
            {formatInviteCode(plaintextCode)}
          </p>
          <p className="text-[12px] tabular-nums text-muted-foreground">
            {inviteCopy.expiresIn(countdown)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleCopy()}
            >
              {copied ? inviteCopy.copied : inviteCopy.copy}
            </Button>
            {confirmCancel ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void revoke()}
                >
                  {inviteCopy.cancelConfirmAction}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmCancel(false)}
                >
                  {inviteCopy.cancelKeep}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmCancel(true)}
              >
                {inviteCopy.cancel}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {uiState === "active-without-value" ? (
        <div className="space-y-3">
          <p role="status" className="text-[13px] text-muted-foreground">
            {inviteCopy.activeWithoutValue(countdown)}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy || atCapacity}
            onClick={() => void generate()}
          >
            {inviteCopy.generateNew}
          </Button>
        </div>
      ) : null}

      {uiState === "expired" ? (
        <div className="space-y-3">
          <p role="status" className="text-[13px] text-muted-foreground">
            {inviteCopy.expired}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy || atCapacity}
            onClick={() => void generate()}
          >
            {inviteCopy.generateNew}
          </Button>
        </div>
      ) : null}

      {uiState === "redeemed" ? (
        <p role="status" className="text-[13px] text-foreground">
          {inviteCopy.redeemed(redeemerName ?? "Alguém")}
        </p>
      ) : null}

      {uiState === "empty" ? (
        <Button
          type="button"
          size="sm"
          disabled={busy || atCapacity}
          onClick={() => void generate()}
        >
          {inviteCopy.generateButton}
        </Button>
      ) : null}

      {uiState === "at-capacity" || atCapacity ? (
        <p role="status" className="text-[13px] text-muted-foreground">
          {inviteCopy.atCapacity}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
