import {
  Minimize2,
  Minus,
  GripVertical,
  Keyboard,
  MessageSquare,
  SquareDashedMousePointer,
  type LucideIcon,
} from "lucide-react";
import type { Ref } from "react";

import { cn } from "@/lib/utils";

type FloatingBarProps = {
  isActive: boolean;
  onOpenQuickMenu: () => void;
  onCaptureContext: () => void;
  onCollapseToEdge: () => void;
  onMinimize: () => void;
  onResetPosition: () => void;
  chatButtonRef?: Ref<HTMLButtonElement>;
};

function BarDivider() {
  return <span className="h-3.5 w-px shrink-0 bg-surface-raise-2" aria-hidden />;
}

const shortcuts = [
  { keys: "Ctrl Shift L", label: "Mostrar/ocultar" },
  { keys: "Enter", label: "Abrir chat" },
  { keys: "Esc", label: "Fechar painel" },
] as const;

function BarAction({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  buttonRef,
  controls,
  expanded,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  controls?: string;
  expanded?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      title={label}
      aria-label={label}
      aria-controls={controls}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full outline-none",
        "text-foreground transition-[background-color,transform] duration-150 ease-out",
        // Hover/foco são só fundo + opacidade: escalar o ícone a cada passada
        // do mouse numa barra de 34px vira ruído.
        "[&_svg]:size-3.5 [&_svg]:opacity-50 [&_svg]:transition-opacity [&_svg]:duration-150 [&_svg]:ease-out",
        "hover:bg-surface-hover hover:[&_svg]:opacity-100",
        // Foco neutro e inset: halo externo seria recortado pela janela.
        "focus-visible:bg-surface-hover focus-visible:[&_svg]:opacity-100",
        "focus-visible:inset-ring-1 focus-visible:inset-ring-hairline-strong",
        "active:scale-[0.96]",
        "disabled:pointer-events-none disabled:[&_svg]:opacity-20",
      )}
    >
      <Icon />
    </button>
  );
}

function ShortcutPopover() {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2",
        "rounded-lg border border-hairline bg-popover p-2.5 text-popover-foreground shadow-xl",
        "translate-y-1 scale-[0.96] opacity-0 blur-[1px]",
        "transition-[opacity,transform,filter] duration-180 ease-out",
        "group-hover/chat:translate-y-0 group-hover/chat:scale-100 group-hover/chat:opacity-100 group-hover/chat:blur-0",
        "group-focus-within/chat:translate-y-0 group-focus-within/chat:scale-100 group-focus-within/chat:opacity-100 group-focus-within/chat:blur-0",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
        <Keyboard className="size-3.5 text-muted-foreground" />
        Atalhos
      </div>
      <div className="space-y-1.5">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.label}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="text-muted-foreground">{shortcut.label}</span>
            <kbd className="rounded-md border border-hairline bg-surface-raise-2 px-1.5 py-0.5 font-technical text-[10px] text-foreground">
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FloatingBar({
  isActive,
  onOpenQuickMenu,
  onCaptureContext,
  onCollapseToEdge,
  onMinimize,
  onResetPosition,
  chatButtonRef,
}: FloatingBarProps) {
  return (
    <div className="flex h-full w-full items-center gap-1 px-1.5">
      <span
        data-tauri-drag-region
        title="Mover · Ctrl+Shift+clique redefine a posição"
        onMouseDown={(event) => {
          if (!event.ctrlKey || !event.shiftKey || event.button !== 0) {
            return;
          }
          /*
           * O Tauri escuta `mousedown` no `document` (bubble) para iniciar o
           * arraste; o React despacha no root, que é descendente do document,
           * então parar a propagação aqui cancela o arraste antes dele começar.
           */
          event.preventDefault();
          event.stopPropagation();
          onResetPosition();
        }}
        className={cn(
          "grid h-5 w-4 shrink-0 cursor-grab place-items-center rounded-full",
          "text-foreground/30 transition-colors",
          "hover:bg-surface-hover hover:text-foreground/70 active:cursor-grabbing",
        )}
      >
        <GripVertical className="pointer-events-none size-3" />
      </span>

      <span
        className="grid size-3 shrink-0 place-items-center"
        title={isActive ? "Sistema ativo" : "Sistema inativo"}
        aria-label={isActive ? "Sistema ativo" : "Sistema inativo"}
        role="status"
      >
        <span
          className={cn(
            "size-1.5 rounded-full transition-colors duration-300",
            isActive ? "status-dot-live" : "bg-muted-foreground/25",
          )}
        />
      </span>

      <BarDivider />

      <div className="group/chat relative">
        <BarAction
          icon={MessageSquare}
          label="Chat"
          onClick={onOpenQuickMenu}
          buttonRef={chatButtonRef}
          controls="quick-center-panel"
          expanded={false}
        />
        <ShortcutPopover />
      </div>
      <BarAction
        icon={SquareDashedMousePointer}
        label="Recorte"
        onClick={onCaptureContext}
      />
      <BarAction icon={Minimize2} label="Encolher" onClick={onCollapseToEdge} />
      <BarAction icon={Minus} label="Minimizar" onClick={onMinimize} />
    </div>
  );
}
