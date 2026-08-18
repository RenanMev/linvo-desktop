import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import type {
  BusinessRule,
  WorkspacePermission,
} from "@linvo/shared";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  ImagePlus,
  ScrollText,
  Trash2,
  Video,
} from "lucide-react";

import type { PanelOutletContext } from "@/components/panel/panel-shell";
import {
  SettingsBack,
  SettingsEmpty,
  SettingsError,
  SettingsPage,
  SettingsSection,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkspaceFileBlob } from "@/hooks/use-workspace-file-blob";
import { AuthApiError } from "@/lib/auth/auth-api";
import { cn } from "@/lib/utils";
import * as workspaceApi from "@/lib/workspace/workspace-api";
import { resolveWorkspaceImageUrl } from "@/lib/workspace/workspace-api";
import {
  workspaceInitial,
  workspaceRoleLabel,
} from "@/lib/workspace/workspace-display";
import { rulesCopy } from "@/lib/workspace/workspace-rules-copy";
import { WorkspacePeopleSection } from "@/pages/settings/workspace-people-section";
import { WorkspaceRulesPanel } from "@/pages/settings/workspace-rules-panel";

function DestinationRow({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={actionLabel}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-raise-2 text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[12px] text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function WorkspaceDetailPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { session } = useOutletContext<PanelOutletContext>();
  const {
    workspaces,
    activeWorkspace,
    refresh,
    renameWorkspace,
    deleteWorkspace,
    selectWorkspace,
    uploadImage,
    removeImage,
  } = useWorkspace();

  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  const isActive = activeWorkspace?.id === workspace?.id;
  const isOwner = workspace?.role === "OWNER";
  const isLastWorkspace = workspaces.length <= 1;

  const can = useCallback(
    (permission: WorkspacePermission) =>
      workspace?.permissions.includes(permission) ?? false,
    [workspace],
  );

  const canUpdate = can("workspace:update");
  const canReadRules = can("rules:read");
  const canWriteRules = can("rules:write");
  const canDeleteRules = can("rules:delete");

  const [renameValue, setRenameValue] = useState(workspace?.name ?? "");
  const [confirmName, setConfirmName] = useState("");
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRenameValue(workspace?.name ?? "");
  }, [workspace?.name]);

  useEffect(() => {
    if (!workspace || !canReadRules) {
      setRules([]);
      return;
    }
    void workspaceApi
      .listBusinessRules(workspace.id)
      .then(setRules)
      .catch(() => setError("Não foi possível carregar as regras"));
  }, [canReadRules, workspace]);

  async function handleActivate() {
    if (!workspace || isActive) return;
    setBusy(true);
    setError(null);
    try {
      await selectWorkspace(workspace.id, { navigateToChat: false });
    } catch {
      setError("Não foi possível ativar o workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!workspace || !renameValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await renameWorkspace(workspace.id, renameValue.trim());
    } catch {
      setError("Não foi possível renomear o workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadImage(file: File | null) {
    if (!workspace || !file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadImage(workspace.id, file);
    } catch {
      setError("Não foi possível atualizar a foto");
    } finally {
      setBusy(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveImage() {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      await removeImage(workspace.id);
    } catch {
      setError("Não foi possível remover a foto");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRule(input: { title: string; content: string }) {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      const created = await workspaceApi.createBusinessRule(workspace.id, input);
      setRules((prev) => [...prev, created]);
    } catch {
      setError("Não foi possível criar a regra");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      await workspaceApi.deleteBusinessRule(workspace.id, ruleId);
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
    } catch {
      setError("Não foi possível remover a regra");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!workspace || !can("workspace:delete")) return;
    if (confirmName !== workspace.name) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWorkspace(workspace.id, confirmName);
      navigate("/settings/workspace");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível apagar o workspace");
      }
    } finally {
      setBusy(false);
    }
  }

  const renameDirty =
    Boolean(workspace) &&
    renameValue.trim() !== (workspace?.name ?? "") &&
    renameValue.trim().length > 0;

  const canDelete =
    Boolean(workspace) &&
    can("workspace:delete") &&
    !isLastWorkspace &&
    confirmName === (workspace?.name ?? "");

  const imageUrl = workspace
    ? resolveWorkspaceImageUrl(workspace.imageUrl)
    : null;
  const { blobUrl: imageSrc } = useWorkspaceFileBlob(imageUrl);

  if (!workspace) {
    return (
      <SettingsPage>
        <SettingsBack onClick={() => navigate("/settings/workspace")} />
        <SettingsEmpty
          icon={<Building2 className="size-5 text-muted-foreground/70" />}
          title="Workspace não encontrado"
          description="Ele pode ter sido removido ou você não tem mais acesso."
        />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage>
      <div className="space-y-5">
        <SettingsBack onClick={() => navigate("/settings/workspace")} />

        <div className="flex items-start gap-3.5">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) =>
              void handleUploadImage(event.target.files?.[0] ?? null)
            }
          />
          {canUpdate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => imageInputRef.current?.click()}
              aria-label={
                workspace.imageUrl ? "Alterar foto" : "Adicionar foto"
              }
              className="group relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-raise-2 text-sm font-semibold"
            >
              {imageSrc ? (
                <img src={imageSrc} alt="" className="size-full object-cover" />
              ) : (
                workspaceInitial(workspace.name)
              )}
              <span className="absolute inset-0 grid place-items-center bg-foreground/50 text-background opacity-0 transition-opacity group-hover:opacity-100">
                <ImagePlus className="size-4" />
              </span>
            </button>
          ) : (
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-semibold",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-surface-raise-2 text-foreground",
              )}
            >
              {imageSrc ? (
                <img src={imageSrc} alt="" className="size-full object-cover" />
              ) : (
                workspaceInitial(workspace.name)
              )}
            </span>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {workspace.name}
                </h1>
                <p className="text-[13px] text-muted-foreground">
                  {workspaceRoleLabel(workspace.role)}
                  {isActive ? " · Ativo" : ""}
                </p>
              </div>
              {!isActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleActivate()}
                >
                  Ativar
                </Button>
              ) : null}
            </div>

            {canUpdate ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  placeholder="Nome do workspace"
                  className="h-8 min-w-0 flex-1 text-xs"
                  aria-label="Renomear workspace"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !renameDirty}
                  className="shrink-0"
                  onClick={() => void handleRename()}
                >
                  Salvar
                </Button>
              </div>
            ) : null}

            {canUpdate && workspace.imageUrl ? (
              <button
                type="button"
                disabled={busy}
                className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => void handleRemoveImage()}
              >
                Remover foto
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <SettingsError message={error} /> : null}

      <div className="space-y-0.5">
        {canReadRules ? (
          <DestinationRow
            icon={ScrollText}
            title={rulesCopy.catalogTitle}
            description={
              rules.length === 0
                ? rulesCopy.catalogEmpty
                : rules.length === 1
                  ? rulesCopy.catalogOne
                  : rulesCopy.catalogMany(rules.length)
            }
            actionLabel={rulesCopy.catalogOpen}
            onClick={() => setRulesOpen(true)}
          />
        ) : null}
        {can("discovery:manage") ? (
          <DestinationRow
            icon={ClipboardCheck}
            title={rulesCopy.extractTitle}
            description={rulesCopy.extractRowHint}
            actionLabel={rulesCopy.extractOpen}
            onClick={() =>
              navigate(`/settings/workspace/${workspace.id}/rule-review`)
            }
          />
        ) : null}
        <DestinationRow
          icon={Video}
          title="Procedures"
          description="Grave a tela, revise e publique procedimentos."
          actionLabel="Abrir Procedures"
          onClick={() =>
            navigate(`/settings/workspace/${workspace.id}/procedures`)
          }
        />
      </div>

      {session.user ? (
        <WorkspacePeopleSection
          workspaceId={workspace.id}
          isOwner={isOwner}
          canManage={can("members:manage")}
          canManageInvites={can("invites:manage")}
          currentUserId={session.user.id}
          onMembershipChanged={() => void refresh({ includeHidden: true })}
        />
      ) : null}

      {rulesOpen && canReadRules ? (
        <WorkspaceRulesPanel
          rules={rules}
          busy={busy}
          canWrite={canWriteRules}
          canDelete={canDeleteRules}
          onClose={() => setRulesOpen(false)}
          onDelete={handleDeleteRule}
          onCreate={handleCreateRule}
        />
      ) : null}

      {can("workspace:delete") ? (
        <SettingsSection
          title="Zona de perigo"
          description="Apagar remove dados, regras e conversas deste workspace."
        >
          <div className="space-y-3 rounded-lg border border-destructive/30 px-3 py-3">
            {isLastWorkspace ? (
              <p className="text-[13px] text-muted-foreground">
                Não é possível apagar o único workspace. Crie outro antes de
                remover este.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">
                  Digite{" "}
                  <span className="font-medium text-foreground">
                    {workspace.name}
                  </span>{" "}
                  para confirmar.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={confirmName}
                    onChange={(event) => setConfirmName(event.target.value)}
                    placeholder="Nome do workspace"
                    className="h-8 text-xs"
                    aria-label="Confirmar nome do workspace"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy || !canDelete}
                    onClick={() => void handleDeleteWorkspace()}
                  >
                    <Trash2 className="size-3.5" />
                    Apagar
                  </Button>
                </div>
              </>
            )}
          </div>
        </SettingsSection>
      ) : null}
    </SettingsPage>
  );
}
