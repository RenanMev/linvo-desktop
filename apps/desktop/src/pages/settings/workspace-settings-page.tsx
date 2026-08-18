import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Workspace } from "@linvo/shared";
import { Building2, KeyRound, Plus } from "lucide-react";

import {
  SettingsEmpty,
  SettingsError,
  SettingsHeader,
  SettingsPage,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkspaceFileBlob } from "@/hooks/use-workspace-file-blob";
import { inviteCopy } from "@/lib/workspace/invite-copy";
import {
  workspaceInitial,
  workspaceRoleLabel,
} from "@/lib/workspace/workspace-display";
import {
  listWorkspaces,
  resolveWorkspaceImageUrl,
} from "@/lib/workspace/workspace-api";
import { cn } from "@/lib/utils";

function WorkspaceRow({
  workspace,
  active,
  busy,
  onActivate,
  onOpenSettings,
}: {
  workspace: Workspace;
  active: boolean;
  busy: boolean;
  onActivate: () => void;
  onOpenSettings: () => void;
}) {
  const imageUrl = resolveWorkspaceImageUrl(workspace.imageUrl);
  const { blobUrl: imageSrc } = useWorkspaceFileBlob(imageUrl);
  const isPersonal = workspace.hidden === true;
  const meta = isPersonal
    ? inviteCopy.personalWorkspace
    : workspaceRoleLabel(workspace.role);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
        active ? "bg-surface-raise-1" : "hover:bg-surface-hover",
      )}
    >
      <button
        type="button"
        disabled={busy}
        onClick={onOpenSettings}
        aria-label={`Configurar ${workspace.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-semibold",
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "bg-surface-raise-2 text-muted-foreground",
          )}
        >
          {imageSrc ? (
            <img src={imageSrc} alt="" className="size-full object-cover" />
          ) : (
            workspaceInitial(workspace.name)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">
            {workspace.name}
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {meta}
            {active ? " · Ativo" : ""}
          </span>
        </span>
      </button>
      {active ? (
        <span className="shrink-0 font-technical text-[10px] tracking-wide text-muted-foreground">
          Ativo
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          className="shrink-0 text-muted-foreground"
          aria-label={`Ativar ${workspace.name}`}
          onClick={onActivate}
        >
          Ativar
        </Button>
      )}
    </div>
  );
}

export function WorkspaceSettingsPage() {
  const navigate = useNavigate();
  const { activeWorkspace, selectWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listWorkspaces({ includeHidden: true })
      .then((list) => {
        if (!cancelled) {
          setWorkspaces(list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalError("Não foi possível carregar os workspaces");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleActivate(workspaceId: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await selectWorkspace(workspaceId, { navigateToChat: false });
    } catch {
      setLocalError("Não foi possível ativar o workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage>
      <SettingsHeader
        title="Workspace"
        description="Escolha o contexto do assistente ou abra as configurações de cada um."
        actions={
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => navigate("/settings/workspace/join")}
            >
              <KeyRound className="size-3.5" />
              {inviteCopy.joinTitle}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate("/settings/workspace/new")}
            >
              <Plus className="size-3.5" />
              Novo workspace
            </Button>
          </>
        }
      />

      {localError ? <SettingsError message={localError} /> : null}

      {isLoading ? (
        <p className="px-2.5 text-[13px] text-muted-foreground">Carregando...</p>
      ) : workspaces.length === 0 ? (
        <SettingsEmpty
          icon={<Building2 className="size-5 text-muted-foreground/70" />}
          title="Nenhum workspace ainda"
          description="Crie o primeiro para organizar regras e contexto da empresa."
        >
          <Button
            type="button"
            size="sm"
            onClick={() => navigate("/settings/workspace/new")}
          >
            <Plus className="size-3.5" />
            Criar workspace
          </Button>
        </SettingsEmpty>
      ) : (
        <div className="space-y-0.5">
          {workspaces.map((workspace) => (
            <WorkspaceRow
              key={workspace.id}
              workspace={workspace}
              active={activeWorkspace?.id === workspace.id}
              busy={busy}
              onActivate={() => void handleActivate(workspace.id)}
              onOpenSettings={() =>
                navigate(`/settings/workspace/${workspace.id}`)
              }
            />
          ))}
        </div>
      )}
    </SettingsPage>
  );
}
