import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Procedure, ProcedureStatus } from "@linvo/shared";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";
import { AuthApiError } from "@/lib/auth/auth-api";
import * as procedureApi from "@/lib/procedure/procedure-api";

const LIST_STATUSES: ProcedureStatus[] = [
  "PENDING_REVIEW",
  "FAILED",
  "PUBLISHED",
];

function statusLabel(status: ProcedureStatus): string {
  switch (status) {
    case "PROCESSING":
      return "Processando";
    case "PENDING_REVIEW":
      return "Em revisão";
    case "PUBLISHED":
      return "Publicado";
    case "FAILED":
      return "Falhou";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function procedureTitle(procedure: Procedure): string {
  if (procedure.title?.trim()) {
    return procedure.title;
  }
  if (procedure.slug?.trim()) {
    return `/${procedure.slug}`;
  }
  return `Procedure ${procedure.id.slice(0, 8)}`;
}

export function ProcedurePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspaces } = useWorkspace();
  const workspace = workspaces.find((item) => item.id === workspaceId);

  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await procedureApi.listProcedures(
          workspaceId!,
          LIST_STATUSES,
        );
        if (!cancelled) {
          setProcedures(items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof AuthApiError
              ? err.message
              : "Não foi possível carregar os procedures",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!workspaceId || !workspace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
        <p>Workspace não encontrado</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate("/settings/workspace")}
        >
          Voltar
        </Button>
      </div>
    );
  }

  const pending = procedures.filter((p) => p.status === "PENDING_REVIEW");
  const failed = procedures.filter((p) => p.status === "FAILED");
  const published = procedures.filter((p) => p.status === "PUBLISHED");
  const selected = procedures.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/settings/workspace/${workspace.id}`)}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">Procedures</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {workspace.name}
          </p>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando procedures...
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error ? (
            <>
              <ProcedureSection
                title="Em revisão"
                empty="Nenhum procedure aguardando revisão"
                items={pending}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <ProcedureSection
                title="Falhou"
                empty="Nenhuma falha recente"
                items={failed}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <ProcedureSection
                title="Publicados"
                empty="Nenhum procedure publicado"
                items={published}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </>
          ) : null}

          {selected ? (
            <section className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
              <h2 className="text-sm font-medium">{procedureTitle(selected)}</h2>
              <p className="text-[11px] text-muted-foreground">
                Status: {statusLabel(selected.status)}
                {selected.slug ? ` · /${selected.slug}` : ""}
              </p>
              {selected.error ? (
                <p className="text-xs text-destructive">{selected.error}</p>
              ) : null}
              {selected.markdown ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs">
                  {selected.markdown}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem markdown disponível
                </p>
              )}
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProcedureSection({
  title,
  empty,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  empty: string;
  items: Procedure[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
          <FileText className="size-5 text-muted-foreground/70" />
          <p className="text-xs text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selectedId === item.id
                    ? "border-foreground/30 bg-muted/40"
                    : "border-border/60 bg-muted/20 hover:bg-muted/30"
                }`}
                onClick={() => onSelect(item.id)}
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-xs font-medium">
                    {procedureTitle(item)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {statusLabel(item.status)}
                    {item.slug ? ` · /${item.slug}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
