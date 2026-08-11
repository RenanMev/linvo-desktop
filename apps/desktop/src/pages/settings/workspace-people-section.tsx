import { useCallback, useEffect, useState } from "react";
import { MAX_WORKSPACE_MEMBERS, type WorkspaceMember } from "@linvo/shared";

import { InviteCodePanel } from "@/components/settings/invite-code-panel";
import { Button } from "@/components/ui/button";
import { useInviteCode } from "@/hooks/use-invite-code";
import { AuthApiError } from "@/lib/auth/auth-api";
import { inviteCopy } from "@/lib/workspace/invite-copy";
import * as membersApi from "@/lib/workspace/members-api";
import * as workspaceApi from "@/lib/workspace/workspace-api";

function formatJoinedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function memberRoleLabel(role: WorkspaceMember["role"]): string {
  return role === "OWNER" ? inviteCopy.roleOwner : inviteCopy.roleMember;
}

export function WorkspacePeopleSection({
  workspaceId,
  isOwner,
  currentUserId,
}: {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string;
}) {
  const invite = useInviteCode(workspaceId);
  const { markAtCapacity, setOnRedeemed } = invite;
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceCount, setWorkspaceCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reloadMembers = useCallback(async () => {
    try {
      const [list, workspaces] = await Promise.all([
        membersApi.listMembers(workspaceId),
        workspaceApi.listWorkspaces({ includeHidden: true }),
      ]);
      setMembers(list);
      setWorkspaceCount(workspaces.length);
      markAtCapacity(list.length >= MAX_WORKSPACE_MEMBERS);
      setError(null);
    } catch {
      setError("Não foi possível carregar as pessoas");
    } finally {
      setLoading(false);
    }
  }, [markAtCapacity, workspaceId]);

  useEffect(() => {
    setLoading(true);
    void reloadMembers();
  }, [reloadMembers]);

  useEffect(() => {
    setOnRedeemed(() => {
      void reloadMembers();
    });
    return () => setOnRedeemed(null);
  }, [reloadMembers, setOnRedeemed]);

  async function handleRemove(member: WorkspaceMember) {
    setBusyUserId(member.userId);
    setError(null);
    try {
      await membersApi.removeMember(workspaceId, member.userId);
      setConfirmUserId(null);
      setStatusMessage(inviteCopy.removed(member.name));
      await reloadMembers();
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível remover a pessoa");
      }
    } finally {
      setBusyUserId(null);
    }
  }

  const isSolo = workspaceCount <= 1 && members.length <= 1;
  if (!loading && isSolo) {
    return null;
  }

  const showCount = members.length > 1;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium">{inviteCopy.section}</h2>
          {showCount ? (
            <p className="text-[11px] text-muted-foreground">
              {inviteCopy.memberCount(members.length)}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      ) : null}

      {statusMessage ? (
        <p role="status" className="text-xs text-muted-foreground">
          {statusMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const canRemove =
              isOwner &&
              member.userId !== currentUserId &&
              member.role !== "OWNER";
            const confirming = confirmUserId === member.userId;

            return (
              <div
                key={member.userId}
                className="rounded-xl border border-hairline bg-muted/40 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-xs font-medium">{member.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {member.email}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {memberRoleLabel(member.role)} ·{" "}
                      {formatJoinedAt(member.joinedAt)}
                    </p>
                  </div>
                  {canRemove ? (
                    confirming ? (
                      <div className="flex max-w-[12rem] flex-col items-end gap-1.5">
                        <p className="text-right text-[11px] text-muted-foreground">
                          {inviteCopy.removeConfirm(member.name)}
                        </p>
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busyUserId === member.userId}
                            onClick={() => void handleRemove(member)}
                          >
                            {inviteCopy.removeAction}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyUserId === member.userId}
                            onClick={() => setConfirmUserId(null)}
                          >
                            {inviteCopy.keep}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmUserId(member.userId)}
                      >
                        {inviteCopy.remove}
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isOwner ? <InviteCodePanel invite={invite} /> : null}
    </section>
  );
}
