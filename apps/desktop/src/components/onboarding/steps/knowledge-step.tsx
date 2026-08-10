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

import {
  StepActions,
  StepHeader,
  StepLink,
  StepPrimary,
} from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/documents/format-bytes";
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
  onBack?: () => void;
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
  onBack,
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
      <StepHeader
        title="Traga conhecimento para o workspace"
        description="Envie documentos para extrair regras reais ou marque Procedures para explorar depois."
      />

      <div className="scrollbar-elegant -mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(Array.from(event.dataTransfer.files));
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-dashed px-4 py-7 text-center outline-none transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-ring/40"
        >
          <UploadCloud className="size-5 text-text-tertiary" />
          <span className="text-[13px] font-medium">
            Selecione ou arraste documentos
          </span>
          <span className="text-[11px] text-text-tertiary">
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
          <p role="alert" className="text-[11px] text-destructive">
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
                    <span className="block truncate text-[13px] font-medium">
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
            className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-raise-1 px-3 py-2.5"
          >
            <div>
              <p className="text-[13px] font-medium">
                {isPolling ? "Extraindo conhecimento..." : "Processamento"}
              </p>
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                {documentCount}{" "}
                {documentCount === 1 ? "documento" : "documentos"} ·{" "}
                {candidateCount}{" "}
                {candidateCount === 1 ? "candidato" : "candidatos"}
              </p>
            </div>
            {isPolling ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-text-secondary" />
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          aria-pressed={knowledgeIntent === "procedures"}
          onClick={onSelectProcedures}
          className={cn(
            "flex w-full items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
            knowledgeIntent === "procedures"
              ? "border-accent-active/45 bg-surface-raise-2"
              : "border-hairline bg-surface-raise-1 hover:bg-surface-hover",
          )}
        >
          <Video className="mt-0.5 size-4 shrink-0 text-text-secondary" />
          <span>
            <span className="block text-[13px] font-medium">Procedures</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-text-secondary">
              Grave sua tela depois para transformar um processo em procedimento
              consultável.
            </span>
          </span>
        </button>
      </div>

      <StepActions
        links={
          <>
            {onBack ? (
              <StepLink disabled={busy} onClick={onBack}>
                Voltar
              </StepLink>
            ) : null}
            <StepLink disabled={busy} onClick={onSkip}>
              Pular por agora
            </StepLink>
          </>
        }
      >
        <StepPrimary disabled={busy} onClick={onContinue}>
          Continuar
        </StepPrimary>
      </StepActions>
    </section>
  );
}
