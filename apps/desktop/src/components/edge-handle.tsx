import type { EdgeAnchor } from "@/lib/window-anchor";
import { cn } from "@/lib/utils";

type EdgeHandleProps = {
  anchor: EdgeAnchor;
  isActive: boolean;
  onExpand: () => void;
};

export function EdgeHandle({ anchor, isActive, onExpand }: EdgeHandleProps) {
  const vertical = !(
    anchor.horizontal === null && anchor.vertical !== null
  );
  const orientation = vertical ? "vertical" : "horizontal";

  return (
    <button
      type="button"
      onClick={onExpand}
      title="Expandir"
      aria-label={`Expandir barra. Sistema ${isActive ? "ativo" : "inativo"}`}
      data-orientation={orientation}
      className={cn(
        "floating-pill flex h-full w-full items-center justify-center rounded-full",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        vertical ? "flex-col" : "flex-row",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full transition-colors duration-300",
          isActive ? "status-dot-live" : "bg-muted-foreground/25",
        )}
      />
    </button>
  );
}
