import type { RuleDiscoverySessionDetail } from "@linvo/shared";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { OnboardingKnowledgeIntent } from "@/lib/onboarding/onboarding-routing";
import { cn } from "@/lib/utils";
import { ACCEPTED_TYPES } from "@/pages/settings/rule-review-page";

const ACCEPTED_MIME_TYPES = new Set(ACCEPTED_TYPES.split(","));
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 4;

function acceptsFile(file: File): boolean {
  return (
    ACCEPTED_MIME_TYPES.has(file.type) ||
    (file.type === "" && file.name.toLowerCase().endsWith(".xlsx"))
  );
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type KnowledgeStepProps = {
  session: RuleDiscoverySessionDetail | null;
  isPolling: boolean;
  busy?: boolean;
  error: string | null;
  knowledgeIntent: OnboardingKnowledgeIntent;
  onConfirmFiles: (files: File[]) => Promise<void>;
  onSelectProcedures: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function KnowledgeStep({
  session,
  isPolling,
  busy = false,
  error,
  knowledgeIntent,
  onConfirmFiles,
  onSelectProcedures,
  onContinue,
  onSkip,
}: KnowledgeStepProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function addFiles(selected: File[]) {
    const unsupported = selected.filter((file) => !acceptsFile(file));
    const empty = selected.filter(
      (file) => acceptsFile(file) && file.size === 0,
    );
    const oversized = selected.filter(
      (file) => acceptsFile(file) && file.size > MAX_FILE_SIZE,
    );
    const valid = selected.filter(
      (file) =>
        acceptsFile(file) &&
        file.size > 0 &&
        file.size <= MAX_FILE_SIZE,
    );
    const availableSlots = Math.max(0, MAX_FILES - files.length);
    const accepted = valid.slice(0, availableSlots);
    const excessCount = valid.length - accepted.length;

    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
    }

    const messages: string[] = [];
    if (unsupported.length > 0) {
      messages.push(
        `${unsupported.length} ${
          unsupported.length === 1
            ? "arquivo não é compatível"
            : "arquivos não são compatíveis"
        }`,
      );
    }
    if (empty.length > 0) {
      messages.push("Arquivos vazios não podem ser enviados");
    }
    if (oversized.length > 0) {
      messages.push("Cada arquivo deve ter no máximo 5 MB");
    }
    if (excessCount > 0) {
      messages.push("Selecione no máximo 4 arquivos");
    }
    setFileError(messages.length > 0 ? messages.join(". ") : null);
  }

  async function handleUpload() {
    if (files.length === 0 || uploading) {
      return;
    }
    setUploading(true);
    await onConfirmFiles(files);
    setUploading(false);
  }

  const candidateCount = session?.candidates.length ?? 0;
  const documentCount = session?.documents.length ?? 0;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-4 space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Traga conhecimento para o workspace
        </h1>
        <p className="text-sm text-text-secondary">
          Envie documentos para extrair regras reais ou marque Procedures para
          explorar depois.
        </p>
      </div>

      <div className="scrollbar-elegant min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(Array.from(event.dataTransfer.files));
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-surface-raise-1 px-4 py-5 text-center outline-none transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-ring/50"
        >
          <UploadCloud className="size-5 text-text-secondary" />
          <span className="text-sm font-medium">
            Selecione ou arraste documentos
          </span>
          <span className="text-xs text-text-secondary">
            PDF, TXT ou XLSX · até 4 arquivos · 5 MB cada
          </span>
          <input
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            aria-label="Documentos de conhecimento"
            className="sr-only"
            onChange={(event) =>
              addFiles(Array.from(event.target.files ?? []))
            }
          />
        </label>

        {fileError ? (
          <p role="alert" className="text-xs text-destructive">
            {fileError}
          </p>
        ) : null}

        {files.length > 0 ? (
          <div className="space-y-2">
            {files.map((file, index) => {
              const Icon = file.name.toLowerCase().endsWith(".xlsx")
                ? FileSpreadsheet
                : FileText;
              return (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-raise-1 px-3 py-2"
                >
                  <Icon className="size-4 shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {file.name}
                    </span>
                    <span className="font-technical text-[10px] text-text-tertiary">
                      {formatBytes(file.size)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={`Remover ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => void handleUpload()}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UploadCloud className="size-3.5" />
              )}
              {uploading ? "Enviando..." : "Processar documentos"}
            </Button>
          </div>
        ) : null}

        {session ? (
          <div
            role="status"
            className="rounded-xl border border-hairline bg-surface-raise-1 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">
                  {isPolling ? "Extraindo conhecimento..." : "Processamento"}
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  {documentCount}{" "}
                  {documentCount === 1 ? "documento" : "documentos"} ·{" "}
                  {candidateCount}{" "}
                  {candidateCount === 1 ? "candidato" : "candidatos"}
                </p>
              </div>
              {isPolling ? (
                <Loader2 className="size-4 animate-spin text-text-secondary" />
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          aria-pressed={knowledgeIntent === "procedures"}
          onClick={onSelectProcedures}
          className={cn(
            "flex w-full items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
            knowledgeIntent === "procedures"
              ? "border-hairline-strong bg-surface-raise-2"
              : "border-hairline bg-surface-raise-1 hover:bg-surface-hover",
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-raise-2">
            <Video className="size-4 text-text-secondary" />
          </span>
          <span>
            <span className="block text-sm font-medium">Procedures</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
              Grave sua tela depois para transformar um processo em procedimento
              consultável.
            </span>
          </span>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
        <Button type="button" variant="ghost" disabled={busy} onClick={onSkip}>
          Pular por agora
        </Button>
        <Button type="button" disabled={busy} onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </section>
  );
}
