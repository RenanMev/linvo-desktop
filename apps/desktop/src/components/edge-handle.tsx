import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import type { Ref } from "react";

import type { EdgeAnchor } from "@/lib/window-anchor";
import { cn } from "@/lib/utils";

type EdgeHandleProps = {
  anchor: EdgeAnchor;
  isActive: boolean;
  onExpand: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
};

/**
 * Tira vertical nas laterais, horizontal em topo/base — precisa casar com
 * `edgeHandleSize`, senão o conteúdo não bate com o formato da janela.
 */
function isVerticalStripe(anchor: EdgeAnchor): boolean {
  return !(anchor.horizontal === null && anchor.vertical !== null);
}

/** Chevron aponta para longe da borda: o gesto é "puxar de volta pra tela". */
function expandIcon(anchor: EdgeAnchor): LucideIcon {
  if (!isVerticalStripe(anchor)) {
    return anchor.vertical === "top" ? ChevronDown : ChevronUp;
  }
  return anchor.horizontal === "right" ? ChevronLeft : ChevronRight;
}

export function EdgeHandle({
  anchor,
  isActive,
  onExpand,
  buttonRef,
}: EdgeHandleProps) {
  const vertical = isVerticalStripe(anchor);
  const Icon = expandIcon(anchor);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onExpand}
      title="Expandir barra"
      aria-label={`Expandir barra. Sistema ${isActive ? "ativo" : "inativo"}`}
      data-orientation={vertical ? "vertical" : "horizontal"}
      className={cn(
        // A superfície da pílula (fundo + hairline) vem do shell em BarApp —
        // repetir `floating-pill` aqui empilhava duas bordas de 1px.
        "group/edge relative flex h-full w-full cursor-pointer items-center justify-center",
        "rounded-pill outline-none",
        "transition-colors duration-150 ease-out hover:bg-surface-hover",
        // Foco inset pelo mesmo motivo da barra: a janela é do tamanho da alça.
        "focus-visible:inset-ring-1 focus-visible:inset-ring-hairline-strong",
        vertical ? "flex-col" : "flex-row",
      )}
    >
      {/*
       * Os dois ícones ficam no DOM e fazem cross-fade por opacidade + escala:
       * alternar `hidden` não animaria a saída. Sem blur — numa tira de 12px não
       * se percebe e custa paint a cada passada do mouse.
       */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute size-1.5 rounded-full",
          "transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
          "group-hover/edge:scale-25 group-hover/edge:opacity-0",
          "group-focus-visible/edge:scale-25 group-focus-visible/edge:opacity-0",
          isActive ? "status-dot-live" : "bg-muted-foreground/25",
        )}
      />
      <Icon
        aria-hidden="true"
        className={cn(
          "absolute size-2.5 scale-25 text-text-tertiary opacity-0",
          "transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
          "group-hover/edge:scale-100 group-hover/edge:opacity-100",
          "group-focus-visible/edge:scale-100 group-focus-visible/edge:opacity-100",
        )}
      />
    </button>
  );
}
