import { FileAudio, X } from "lucide-react";

import { cn } from "@/lib/utils";

type AudioAttachmentChipProps = {
  filename: string;
  sizeBytes?: number;
  disabled?: boolean;
  onRemove?: () => void;
  /** Sem `onRemove`: chip de leitura (mensagem enviada). */
  transcript?: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Áudio anexado (KAN-43): no composer, antes de enviar; na mensagem, com a
 * transcrição que a API devolveu — é o que o modelo leu.
 */
export function AudioAttachmentChip({
  filename,
  sizeBytes,
  disabled = false,
  onRemove,
  transcript,
}: AudioAttachmentChipProps) {
  return (
    <div className="flex max-w-full flex-col gap-1">
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border border-hairline bg-surface-raise-2 px-2 py-0.5 text-xs text-foreground/80",
        )}
        title={filename}
      >
        <FileAudio className="size-3.5 shrink-0 text-text-tertiary" />
        <span className="truncate">{filename}</span>
        {sizeBytes != null ? (
          <span className="shrink-0 font-technical text-[10px] text-muted-foreground">
            {formatSize(sizeBytes)}
          </span>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="rounded-md p-0.5 hover:bg-surface-hover"
            title="Remover áudio"
            aria-label={`Remover áudio ${filename}`}
            disabled={disabled}
            onClick={onRemove}
          >
            <X className="size-3" />
          </button>
        ) : null}
      </span>
      {transcript ? (
        <p className="max-w-prose whitespace-pre-wrap border-l-2 border-hairline pl-2 text-xs text-muted-foreground">
          {transcript}
        </p>
      ) : null}
    </div>
  );
}
