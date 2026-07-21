import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Procedure, ProcedureStatus } from "@linvo/shared";
import { ArrowLeft, FileText, Loader2, Square, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";
import { useProcedureRecorder } from "@/hooks/use-procedure-recorder";
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
  const recorder = useProcedureRecorder();

  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    if (!workspaceId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await procedureApi.listProcedures(
        workspaceId,
        LIST_STATUSES,
      );
      setProcedures(items);
    } catch (err) {
      setError(
        err instanceof AuthApiError
          ? err.message
          : "Não foi possível carregar os procedures",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleConfirmUpload() {
    if (!workspaceId || !recorder.recordedBlob) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await procedureApi.createProcedure(
        workspaceId,
        recorder.recordedBlob,
        recorder.retainVideo,
      );
      recorder.discard();
      await reload();
    } catch (err) {
      setError(
        err instanceof AuthApiError
          ? err.message
          : "Não foi possível enviar o vídeo",
      );
    } finally {
      setUploading(false);
    }
  }

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
  const isRecording =
    recorder.phase === "recording" || recorder.phase === "near_limit";

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
          <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Gravar procedure</h2>
              <p className="text-[11px] text-muted-foreground">
                Escolha tela inteira ou janela. Limite de 2:00; aviso em 1:30.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isRecording && recorder.phase !== "awaiting_confirm" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void recorder.start()}
                >
                  <Video className="size-3.5" />
                  Iniciar gravação
                </Button>
              ) : null}

              {isRecording ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => recorder.stop()}
                  >
                    <Square className="size-3.5" />
                    Parar
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {recorder.elapsedLabel}
                  </span>
                </>
              ) : null}
            </div>

            {recorder.phase === "near_limit" ? (
              <p className="text-xs text-amber-600" role="status">
                A gravação está próxima do limite de 2 minutos.
              </p>
            ) : null}

            {recorder.phase === "awaiting_confirm" ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-background p-3">
                <p className="text-xs">
                  Gravação finalizada. Confirme o envio para processar o
                  procedure.
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={recorder.retainVideo}
                    onChange={(event) =>
                      recorder.setRetainVideo(event.target.checked)
                    }
                  />
                  Manter o vídeo após o processamento
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={uploading || !recorder.recordedBlob}
                    onClick={() => void handleConfirmUpload()}
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Confirmar envio
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={uploading}
                    onClick={() => recorder.discard()}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            ) : null}

            {recorder.error ? (
              <p className="text-xs text-destructive" role="alert">
                {recorder.error}
              </p>
            ) : null}
          </section>

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
