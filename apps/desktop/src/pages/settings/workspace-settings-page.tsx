import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Workspace, WorkspaceRole } from "@linvo/shared";
import { Building2, Check, Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";
import { resolveWorkspaceImageUrl } from "@/lib/workspace/workspace-api";
import { cn } from "@/lib/utils";

function workspaceInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}

function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "OWNER":
      return "Proprietário";
    case "MEMBER":
      return "Membro";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function WorkspaceCard({
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
  const imageSrc = resolveWorkspaceImageUrl(workspace.imageUrl);

  return (
    <div
      className={cn(
        "group relative flex w-[9.5rem] flex-col overflow-hidden rounded-xl border transition-colors",
        active
          ? "border-foreground/25 bg-foreground/[0.05]"
          : "border-border/60 bg-muted/30 hover:border-border hover:bg-muted/45",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-muted/50 text-3xl font-semibold text-muted-foreground/80">
            {workspaceInitial(workspace.name)}
          </span>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
          <label
            className={cn(
              "inline-flex size-6 cursor-pointer items-center justify-center rounded-md border shadow-xs transition-colors",
              active
                ? "border-primary/40 bg-primary text-primary-foreground"
                : "border-border/70 bg-background/90 text-transparent hover:border-border",
              busy && "pointer-events-none opacity-60",
            )}
            title={active ? "Workspace ativo" : "Ativar workspace"}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={active}
              disabled={busy || active}
              onChange={() => {
                if (!active) onActivate();
              }}
              aria-label={
                active
                  ? `${workspace.name} ativo`
                  : `Ativar ${workspace.name}`
              }
            />
            <Check className="size-3.5" strokeWidth={2.5} />
          </label>

          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            disabled={busy}
            aria-label={`Configurar ${workspace.name}`}
            title="Configurar"
            className="border border-border/60 bg-background/90 shadow-xs hover:bg-background"
            onClick={onOpenSettings}
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-0.5 border-t border-border/50 px-2.5 py-2">
        <p className="truncate text-xs font-medium">{workspace.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {roleLabel(workspace.role)}
          {active ? " · Ativo" : ""}
        </p>
      </div>
    </div>
  );
}

export function WorkspaceSettingsPage() {
  const navigate = useNavigate();
  const {
    workspaces,
    activeWorkspace,
    isLoading,
    error,
    selectWorkspace,
  } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-muted/40">
            <Building2 className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Workspace</h1>
            <p className="text-xs text-muted-foreground">
              Ative o contexto do assistente ou abra as configurações de cada
              workspace.
            </p>
          </div>
        </div>

        {error || localError ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="text-xs text-destructive">{localError ?? error}</p>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-medium">Seus workspaces</h2>
                <p className="text-[11px] text-muted-foreground">
                  Marque para ativar · engrenagem para configurar.
                </p>
              </div>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {workspaces.length}
              </span>
            </div>

            {workspaces.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
                <Building2 className="size-5 text-muted-foreground/70" />
                <div className="space-y-1">
                  <p className="text-xs font-medium">Nenhum workspace ainda</p>
                  <p className="max-w-xs text-[11px] text-muted-foreground">
                    Crie o primeiro para organizar regras e contexto da empresa.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate("/settings/workspace/new")}
                >
                  <Plus className="size-3.5" />
                  Criar workspace
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {workspaces.map((workspace) => (
                  <WorkspaceCard
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

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => navigate("/settings/workspace/new")}
                  className="flex w-[9.5rem] flex-col overflow-hidden rounded-xl border border-dashed border-border/70 bg-muted/20 text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                  aria-label="Criar workspace"
                >
                  <span className="grid aspect-square w-full place-items-center">
                    <Plus className="size-7" />
                  </span>
                  <span className="border-t border-border/40 px-2.5 py-2 text-left text-xs font-medium">
                    Novo workspace
                  </span>
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
