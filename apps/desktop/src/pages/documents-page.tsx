import { useCallback, useEffect, useState } from "react";
import type { GeneratedDocument } from "@linvo/shared";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";
import * as documentsApi from "@/lib/documents/documents-api";
import { downloadArtifact } from "@/lib/documents/download";
import { formatBytes } from "@/lib/documents/format-bytes";

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function documentDetails(document: GeneratedDocument): string {
  return [
    formatCreatedAt(document.createdAt),
    document.createdByName,
    formatBytes(document.sizeBytes),
    document.pageCount
      ? `${document.pageCount} ${document.pageCount === 1 ? "página" : "páginas"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DocumentsPage() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspaceId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDocuments(await documentsApi.listDocuments(workspaceId));
    } catch {
      setError("Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleDownload(document: GeneratedDocument) {
    if (!workspaceId) return;
    setBusyId(document.id);
    setError(null);
    try {
      await downloadArtifact({
        workspaceId,
        documentId: document.id,
        filename: document.filename,
      });
    } catch {
      setError(`Não foi possível baixar "${document.title}".`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(document: GeneratedDocument) {
    if (!workspaceId) return;
    const confirmed = window.confirm(
      `Excluir "${document.title}"? O arquivo sai do workspace para todos os membros.`,
    );
    if (!confirmed) {
      return;
    }

    setBusyId(document.id);
    setError(null);
    try {
      await documentsApi.deleteDocument(workspaceId, document.id);
      setDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
    } catch {
      setError(`Não foi possível excluir "${document.title}".`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-hairline px-6 py-4">
        <h1 className="font-display text-[22px] font-bold">Documentos</h1>
        <p className="text-xs text-muted-foreground">
          PDFs gerados pelo assistente neste workspace.
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-6">
          {error ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-neutral-raised px-3 py-2 text-xs text-destructive">
              <span>{error}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void reload()}
              >
                Tentar de novo
              </Button>
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">
              Carregando documentos...
            </p>
          ) : documents.length === 0 ? (
            <div className="rounded-premium border border-border-dashed px-6 py-10 text-center">
              <FileText
                className="mx-auto size-6 text-text-tertiary"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium">Nenhum documento ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Peça um relatório ou resumo em PDF no chat: o arquivo aparece
                aqui depois de você aprovar a geração.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center gap-3 rounded-premium border border-hairline bg-neutral-raised px-4 py-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-popover text-text-tertiary">
                    <FileText className="size-4" aria-hidden />
                  </span>

                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {document.title}
                    </span>
                    <span className="font-technical text-xs text-muted-foreground">
                      {documentDetails(document)}
                    </span>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busyId === document.id}
                      aria-label={`Baixar ${document.filename}`}
                      onClick={() => void handleDownload(document)}
                    >
                      {busyId === document.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="size-4" aria-hidden />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={busyId === document.id}
                      aria-label={`Excluir ${document.title}`}
                      onClick={() => void handleDelete(document)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
