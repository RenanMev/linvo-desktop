import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import {
  MAX_WORKSPACE_MEMBERS,
  type AssignableWorkspaceRole,
  type WorkspaceMember,
  type WorkspacePermission,
} from "@linvo/shared";

import { InviteCodePanel } from "@/components/settings/invite-code-panel";
import {
  SettingsError,
  SettingsSection,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/workspace-context";
import { useInviteCode } from "@/hooks/use-invite-code";
import {
  FOREGROUND_POLL_MS,
  useWorkspaceStatePoll,
} from "@/hooks/use-workspace-state-poll";
import { AuthApiError } from "@/lib/auth/auth-api";
import { cn } from "@/lib/utils";
import { inviteCopy } from "@/lib/workspace/invite-copy";
import * as membersApi from "@/lib/workspace/members-api";
import * as workspaceApi from "@/lib/workspace/workspace-api";
import {
  WorkspacePermissionToggles,
  togglePermission,
} from "@/pages/settings/workspace-permission-toggles";

function formatJoinedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function memberRoleLabel(role: WorkspaceMember["role"]): string {
  switch (role) {
    case "OWNER":
      return inviteCopy.roleOwner;
    case "ADMIN":
      return inviteCopy.roleAdmin;
    default:
      return inviteCopy.roleMember;
  }
}

const ASSIGNABLE_ROLES: { value: AssignableWorkspaceRole; label: string }[] = [
  { value: "ADMIN", label: inviteCopy.roleAdmin },
  { value: "MEMBER", label: inviteCopy.roleMember },
];

export function WorkspacePeopleSection({
  workspaceId,
  isOwner,
  canManage,
  canManageInvites,
  currentUserId,
  onMembershipChanged,
}: {
  workspaceId: string;
  isOwner: boolean;
  canManage: boolean;
  canManageInvites: boolean;
  currentUserId: string;
  onMembershipChanged?: () => void;
}) {
  const { leaveWorkspace } = useWorkspace();
  // Sem `invites:manage` o hook nem busca o código: as rotas de convite exigem
  // essa permissão e a resposta seria 403 em loop de polling.
  const invite = useInviteCode(canManageInvites ? workspaceId : undefined);
  const { markAtCapacity, setOnRedeemed } = invite;
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceCount, setWorkspaceCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [transferUserId, setTransferUserId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
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

  // Alguém entrou, saiu, mudou de papel ou teve permissão alterada por outro
  // administrador. Recarrega a lista e avisa a tela — as permissões do próprio
  // usuário podem ter mudado junto.
  const handleMembersChanged = useCallback(() => {
    void reloadMembers();
    onMembershipChanged?.();
  }, [onMembershipChanged, reloadMembers]);

  const { refreshNow } = useWorkspaceStatePoll(
    workspaceId,
    { members: handleMembersChanged },
    { intervalMs: FOREGROUND_POLL_MS },
  );

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      await reloadMembers();
      await refreshNow();
    } finally {
      setRefreshing(false);
    }
  }

  function reportError(err: unknown, fallback: string) {
    setError(err instanceof AuthApiError ? err.message : fallback);
  }

  async function handleRemove(member: WorkspaceMember) {
    setBusyUserId(member.userId);
    setError(null);
    try {
      await membersApi.removeMember(workspaceId, member.userId);
      setConfirmUserId(null);
      setStatusMessage(inviteCopy.removed(member.name));
      await reloadMembers();
      onMembershipChanged?.();
    } catch (err) {
      reportError(err, "Não foi possível remover a pessoa");
    } finally {
      setBusyUserId(null);
    }
  }

  async function applyMemberUpdate(
    member: WorkspaceMember,
    input: Parameters<typeof membersApi.updateMember>[2],
    fallbackError: string,
  ) {
    setBusyUserId(member.userId);
    setError(null);
    try {
      const updated = await membersApi.updateMember(
        workspaceId,
        member.userId,
        input,
      );
      setMembers((prev) =>
        prev.map((item) => (item.userId === updated.userId ? updated : item)),
      );
      onMembershipChanged?.();
    } catch (err) {
      reportError(err, fallbackError);
      // O servidor é a fonte da verdade: se o update falhou, o estado local
      // pode ter divergido do que a tela mostra.
      await reloadMembers();
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRoleChange(
    member: WorkspaceMember,
    role: AssignableWorkspaceRole,
  ) {
    if (member.role === role) return;
    await applyMemberUpdate(member, { role }, "Não foi possível alterar o papel");
  }

  async function handleTogglePermission(
    member: WorkspaceMember,
    permission: WorkspacePermission,
  ) {
    await applyMemberUpdate(
      member,
      togglePermission(member, permission),
      "Não foi possível alterar a permissão",
    );
  }

  async function handleTransferOwnership(member: WorkspaceMember) {
    setBusyUserId(member.userId);
    setError(null);
    try {
      await workspaceApi.transferWorkspaceOwnership(workspaceId, member.userId);
      setTransferUserId(null);
      setStatusMessage(`${member.name} agora é o dono do workspace.`);
      await reloadMembers();
      onMembershipChanged?.();
    } catch (err) {
      reportError(err, "Não foi possível transferir a posse");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleLeave() {
    setBusyUserId(currentUserId);
    setError(null);
    try {
      // Pelo contexto, não pela API direto: sair zera o workspace ativo no
      // servidor, então alguém precisa ativar o próximo e limpar o cache local
      // de chat — senão a sessão fica apontando para o workspace que acabou de
      // ser abandonado.
      await leaveWorkspace(workspaceId);
      onMembershipChanged?.();
    } catch (err) {
      reportError(err, "Não foi possível sair do workspace");
      setConfirmLeave(false);
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
    <SettingsSection
      title={inviteCopy.section}
      description={showCount ? inviteCopy.memberCount(members.length) : undefined}
      action={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={refreshing}
          aria-label="Atualizar pessoas"
          className="h-7 px-2 text-[12px] text-muted-foreground"
          onClick={() => void handleManualRefresh()}
        >
          <RefreshCw
            className={cn("size-3.5", refreshing && "animate-spin")}
          />
          Atualizar
        </Button>
      }
    >
      {error ? <SettingsError message={error} /> : null}

      {statusMessage ? (
        <p role="status" className="text-[13px] text-muted-foreground">
          {statusMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="px-2.5 text-[13px] text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-0.5">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const isTargetOwner = member.role === "OWNER";
            const editable = canManage && !isSelf && !isTargetOwner;
            const confirming = confirmUserId === member.userId;
            const expanded = expandedUserId === member.userId;
            const busy = busyUserId === member.userId;

            return (
              <div
                key={member.userId}
                className={cn(
                  "rounded-lg px-2.5 py-2.5 transition-colors",
                  expanded ? "bg-surface-raise-1" : "hover:bg-surface-hover",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-[13px] font-medium">
                      {member.name}
                      {isSelf ? (
                        <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                          você
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {member.email}
                    </p>
                    <p className="font-technical text-[10px] tracking-wide text-muted-foreground">
                      {memberRoleLabel(member.role)} ·{" "}
                      {formatJoinedAt(member.joinedAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {editable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-expanded={expanded}
                        aria-label={`Permissões de ${member.name}`}
                        className="h-7 px-2 text-[12px] text-muted-foreground"
                        onClick={() =>
                          setExpandedUserId(expanded ? null : member.userId)
                        }
                      >
                        Permissões
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform",
                            expanded && "rotate-180",
                          )}
                        />
                      </Button>
                    ) : null}

                    {editable ? (
                      confirming ? (
                        <div className="flex max-w-[12rem] flex-col items-end gap-1.5">
                          <p className="text-right text-[12px] text-muted-foreground">
                            {inviteCopy.removeConfirm(member.name)}
                          </p>
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => void handleRemove(member)}
                            >
                              {inviteCopy.removeAction}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
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

                {expanded && editable ? (
                  <div className="mt-3 space-y-3 pt-3">
                    <div className="space-y-1.5">
                      <p className="font-technical text-[10px] font-medium tracking-wide text-muted-foreground">
                        Papel
                      </p>
                      <div className="flex gap-1.5">
                        {ASSIGNABLE_ROLES.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            size="sm"
                            variant={
                              member.role === option.value
                                ? "secondary"
                                : "ghost"
                            }
                            disabled={busy}
                            className="h-7 px-2.5 text-[12px]"
                            onClick={() =>
                              void handleRoleChange(member, option.value)
                            }
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <WorkspacePermissionToggles
                      member={member}
                      disabled={busy}
                      onToggle={(permission) =>
                        void handleTogglePermission(member, permission)
                      }
                    />

                    {isOwner ? (
                      <div className="pt-1">
                        {transferUserId === member.userId ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[12px] text-muted-foreground">
                              Passar a posse para {member.name}? Você vira
                              administrador.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() =>
                                void handleTransferOwnership(member)
                              }
                            >
                              Transferir
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setTransferUserId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[12px] text-muted-foreground"
                            onClick={() => setTransferUserId(member.userId)}
                          >
                            Transferir posse
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !isOwner && members.length > 1 ? (
        <div className="px-2.5 py-2">
          {confirmLeave ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[12px] text-muted-foreground">
                Sair deste workspace? Você perde acesso ao conteúdo dele.
              </p>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busyUserId === currentUserId}
                onClick={() => void handleLeave()}
              >
                Sair
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busyUserId === currentUserId}
                onClick={() => setConfirmLeave(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[12px] text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmLeave(true)}
            >
              Sair do workspace
            </Button>
          )}
        </div>
      ) : null}

      {canManageInvites ? <InviteCodePanel invite={invite} /> : null}
    </SettingsSection>
  );
}
