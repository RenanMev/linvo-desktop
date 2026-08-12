import { X } from "lucide-react";

type CaptureContextChipProps = {
  previewUrl: string;
  label?: string;
  disabled?: boolean;
  onRemove: () => void;
};

/** Miniatura do anexo pendente, com a saída para descartá-lo antes de enviar. */
export function CaptureContextChip({
  previewUrl,
  label,
  disabled = false,
  onRemove,
}: CaptureContextChipProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-raise-2 py-1 pr-1.5 pl-1 text-xs text-foreground/80">
      <img
        src={previewUrl}
        alt=""
        className="size-10 rounded-md object-cover"
      />
      <span className="max-w-36 truncate">{label ?? "Contexto visual"}</span>
      <button
        type="button"
        className="rounded-md p-0.5 hover:bg-surface-hover"
        title="Remover contexto"
        disabled={disabled}
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
