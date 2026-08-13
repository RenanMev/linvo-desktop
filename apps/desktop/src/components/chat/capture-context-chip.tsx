import { X } from "lucide-react";

type CaptureContextChipProps = {
  previewUrl: string;
  label?: string;
  disabled?: boolean;
  onRemove: () => void;
  /** Reabre o preview para recortar de novo. */
  onEdit?: () => void;
};

/** Miniatura do anexo pendente, com a saída para descartá-lo antes de enviar. */
export function CaptureContextChip({
  previewUrl,
  label,
  disabled = false,
  onRemove,
  onEdit,
}: CaptureContextChipProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-raise-2 py-1 pr-1.5 pl-1 text-xs text-foreground/80">
      {/*
       * O recorte magnético anexa direto, sem passar por um modal de
       * confirmação. Quem quiser ajustar o recorte clica na miniatura.
       */}
      {onEdit ? (
        <button
          type="button"
          className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
          title="Ajustar recorte"
          disabled={disabled}
          onClick={onEdit}
        >
          <img
            src={previewUrl}
            alt=""
            className="size-10 rounded-md object-cover"
          />
        </button>
      ) : (
        <img
          src={previewUrl}
          alt=""
          className="size-10 rounded-md object-cover"
        />
      )}
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
