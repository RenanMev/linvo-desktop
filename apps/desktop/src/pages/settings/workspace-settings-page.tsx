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
        "group relative flex w-[15rem] flex-col overflow-hidden rounded-xl border p-4 transition-colors",
        active
          ? "border-foreground/25 bg-foreground/[0.05]"
          : "border-border/60 bg-muted/30 hover:border-border hover:bg-muted/45",
      )}
    >
      <div className="mb-4 flex items-start justify-end">
        <label
          className={cn(
            "inline-flex size-5.5 cursor-pointer items-center justify-center rounded-md border shadow-xs transition-colors",
            active
              ? "border-primary/40 bg-primary text-primary-foreground"
              : "border-border/70 bg-background text-transparent hover:border-border",
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
              active ? `${workspace.name} ativo` : `Ativar ${workspace.name}`
            }
          />
          <Check className="size-3" strokeWidth={2.5} />
        </label>
      </div>

      <div
        className={cn(
          "mb-3.5 grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border text-base font-semibold",
          active
            ? "border-primary/30 bg-primary text-primary-foreground"
            : "border-border/60 bg-muted/50 text-muted-foreground",
        )}
      >
        {imageSrc ? (
          <img src={imageSrc} alt="" className="size-full object-cover" />
        ) : (
          workspaceInitial(workspace.name)
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <p className="truncate text-xs font-medium">{workspace.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {roleLabel(workspace.role)}
          {active ? (
            <>
              {" · "}
              <span className="inline-flex items-center gap-1 text-foreground">
                <span className="size-1 rounded-full bg-foreground" />
                Ativo
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-4 flex justify-end border-t border-border/50 pt-3.5">
        <Button
          type="button"
          size="icon-xs"
          variant="secondary"
          disabled={busy}
          aria-label={`Configurar ${workspace.name}`}
          title="Configurar"
          className="border border-border/60 bg-background shadow-xs hover:bg-background"
          onClick={onOpenSettings}
        >
          <Settings className="size-3.5" />
        </Button>
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

  const activeCount = activeWorkspace ? 1 : 0;

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
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {activeCount} ativo{activeCount === 1 ? "" : "s"}
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
                  className="flex min-h-[10.75rem] w-[15rem] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border/70 bg-muted/20 text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                  aria-label="Criar workspace"
                >
                  <span className="grid size-8 place-items-center rounded-full border border-border/70">
                    <Plus className="size-4" />
                  </span>
                  <span className="text-xs font-medium">Novo workspace</span>
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
