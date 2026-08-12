import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, Crop, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import {
  clampRectToBounds,
  isRectUsable,
  normalizeRect,
  scaleRectToSource,
  type Point,
  type Rect,
} from "@/lib/context-capture/crop";
import { cn } from "@/lib/utils";

type CapturePreviewDialogProps = {
  previewUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceLabel?: string;
  isBusy?: boolean;
  onConfirm: (region: Rect | null) => void;
  onRecapture: () => void;
  onCancel: () => void;
};

export function CapturePreviewDialog({
  previewUrl,
  sourceWidth,
  sourceHeight,
  sourceLabel,
  isBusy = false,
  onConfirm,
  onRecapture,
  onCancel,
}: CapturePreviewDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<Point | null>(null);

  const [selection, setSelection] = useState<Rect | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useFocusTrap(containerRef, { active: true, initialFocusRef: confirmRef });

  const displaySize = useCallback((): { width: number; height: number } => {
    const image = imageRef.current;
    if (!image) {
      return { width: 0, height: 0 };
    }
    return { width: image.clientWidth, height: image.clientHeight };
  }, []);

  const pointFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): Point => {
      const image = imageRef.current;
      if (!image) {
        return { x: 0, y: 0 };
      }
      const bounds = image.getBoundingClientRect();
      return {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isBusy || event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const origin = pointFromEvent(event);
      dragStartRef.current = origin;
      setIsDragging(true);
      setSelection({ x: origin.x, y: origin.y, width: 0, height: 0 });
    },
    [isBusy, pointFromEvent],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = dragStartRef.current;
      if (!origin) {
        return;
      }
      const rect = normalizeRect(origin, pointFromEvent(event));
      setSelection(clampRectToBounds(rect, displaySize()));
    },
    [displaySize, pointFromEvent],
  );

  const endDrag = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    // Um clique simples não é recorte — some com a seleção inútil.
    setSelection((current) =>
      current && isRectUsable(current) ? current : null,
    );
  }, []);

  const confirm = useCallback(() => {
    if (isBusy) {
      return;
    }
    if (!selection || !isRectUsable(selection)) {
      onConfirm(null);
      return;
    }
    onConfirm(
      scaleRectToSource(selection, displaySize(), {
        width: sourceWidth,
        height: sourceHeight,
      }),
    );
  }, [displaySize, isBusy, onConfirm, selection, sourceHeight, sourceWidth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // Esc limpa a seleção antes de fechar: sai do recorte sem perder o
        // frame já capturado.
        if (selection) {
          setSelection(null);
          return;
        }
        onCancel();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        confirm();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm, onCancel, selection]);

  const hasSelection = Boolean(selection && isRectUsable(selection));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      role="presentation"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar contexto visual"
        className="surface-premium flex max-h-full w-full max-w-3xl flex-col gap-2 rounded-premium p-3 shadow-2xl sm:gap-3 sm:p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {sourceLabel ?? "Contexto visual"}
            </p>
            <p className="font-technical text-[11px] tracking-wide text-muted-foreground">
              {hasSelection
                ? "Região selecionada · Esc limpa a seleção"
                : "Arraste sobre a imagem para recortar uma região"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Cancelar"
            aria-label="Cancelar"
            disabled={isBusy}
            onClick={onCancel}
          >
            <X />
          </Button>
        </div>

        <div
          className={cn(
            "relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface-raise-2",
            isBusy ? "cursor-wait" : "cursor-crosshair",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            ref={imageRef}
            src={previewUrl}
            alt="Prévia da captura"
            draggable={false}
            className="max-h-[60vh] max-w-full object-contain"
          />
          {selection ? (
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute border-2 border-primary bg-primary/15",
                isDragging && "border-dashed",
              )}
              style={{
                left: `${selection.x}px`,
                top: `${selection.y}px`,
                width: `${selection.width}px`,
                height: `${selection.height}px`,
                // A imagem é centralizada no container, então a seleção precisa
                // partir da borda dela, não do container.
                transform: `translate(${imageOffsetX(imageRef.current)}px, ${imageOffsetY(imageRef.current)}px)`,
              }}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={onRecapture}
            >
              <RefreshCw />
              Recapturar
            </Button>
            {hasSelection ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => setSelection(null)}
              >
                <Crop />
                Usar imagem inteira
              </Button>
            ) : null}
          </div>
          <Button
            ref={confirmRef}
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={confirm}
          >
            <Check />
            {hasSelection ? "Anexar recorte" : "Anexar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function imageOffsetX(image: HTMLImageElement | null): number {
  if (!image?.parentElement) return 0;
  return (
    image.getBoundingClientRect().left -
    image.parentElement.getBoundingClientRect().left
  );
}

function imageOffsetY(image: HTMLImageElement | null): number {
  if (!image?.parentElement) return 0;
  return (
    image.getBoundingClientRect().top -
    image.parentElement.getBoundingClientRect().top
  );
}
