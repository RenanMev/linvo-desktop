import {
  Minimize2,
  GripVertical,
  Keyboard,
  MessageSquare,
  SquareDashedMousePointer,
  type LucideIcon,
} from "lucide-react";
import type { Ref } from "react";

import type { IslandStatus } from "@/lib/island-status";
import { islandStatusLabel, islandStatusLive } from "@/lib/island-status";
import { cn } from "@/lib/utils";

export type FloatingBarChecklist = {
  title: string;
  completed: number;
  total: number;
};

type FloatingBarProps = {
  status: IslandStatus;
  onOpenQuickMenu: () => void;
  onCaptureContext: () => void;
  onCollapseToEdge: () => void;
  onResetPosition: () => void;
  chatButtonRef?: Ref<HTMLButtonElement>;
  /**
   * Checklist recolhido: a pílula mostra "2/5" e o clique volta a ele. O
   * dot de status vai para dentro do badge — a pílula tem 200px e não
   * cabe os dois lado a lado.
   */
  checklist?: FloatingBarChecklist | null;
  onResumeChecklist?: () => void;
};

function BarDivider() {
  return <span className="h-4 w-px shrink-0 bg-foreground/15" aria-hidden />;
}

/**
 * Traço dos ícones da barra, mais grosso que o padrão do Lucide (2).
 *
 * É o único jeito de deixar os ícones visualmente mais macios: o raio dos
 * cantos vive no próprio `path` de cada ícone (2 de 24 unidades) e não é
 * exposto por prop. Como o Lucide já desenha com `stroke-linejoin: round`,
 * engrossar o traço aumenta o raio efetivo da junção.
 *
 * 2,25 foi medido na tela e quase não se distingue do padrão; 2,5 é onde a
 * junção arredondada passa a ler a 16px de ícone, sem borrar os vazados (o
 * quadrado tracejado do Recorte é o mais apertado, e ainda respira).
 */
const BAR_ICON_STROKE_WIDTH = 2.5;

const shortcuts = [
  { keys: "Ctrl Shift L", label: "Mostrar/ocultar" },
  { keys: "Ctrl Shift C", label: "Capturar e perguntar" },
  { keys: "Enter", label: "Abrir chat" },
  { keys: "Esc", label: "Fechar Assist" },
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
      data-overlay-hit
      title={label}
      aria-label={label}
      aria-controls={controls}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full outline-none",
        "text-foreground transition-[background-color,transform] duration-150 ease-out",
        // Ícones cheios (não apagados) o tempo todo — só o fundo reage ao
        // hover. Escalar o ícone a cada passada do mouse vira ruído, daí o
        // hover ficar restrito ao background.
        "[&_svg]:size-4",
        "hover:bg-surface-hover",
        // Foco neutro e inset: halo externo seria recortado pela janela.
        "focus-visible:bg-surface-hover",
        "focus-visible:inset-ring-1 focus-visible:inset-ring-hairline-strong",
        "active:scale-[0.96]",
        "disabled:pointer-events-none disabled:[&_svg]:opacity-20",
      )}
    >
      <Icon strokeWidth={BAR_ICON_STROKE_WIDTH} />
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
  status,
  onOpenQuickMenu,
  onCaptureContext,
  onCollapseToEdge,
  onResetPosition,
  chatButtonRef,
  checklist = null,
  onResumeChecklist,
}: FloatingBarProps) {
  const statusDot = (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full transition-colors duration-300",
        islandStatusLive(status) ? "status-dot-live" : "bg-muted-foreground/25",
      )}
    />
  );
  return (
    <div className="flex h-full w-full items-center gap-1.5 px-2">
      <span
        data-overlay-hit
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
          "grid h-6 w-5 shrink-0 cursor-grab place-items-center rounded-full",
          "text-foreground/30 transition-colors",
          "hover:bg-surface-hover hover:text-foreground/70 active:cursor-grabbing",
        )}
      >
        <GripVertical
          className="pointer-events-none size-3.5"
          strokeWidth={BAR_ICON_STROKE_WIDTH}
        />
      </span>

      {checklist ? (
        <button
          type="button"
          data-overlay-hit
          title={`Voltar ao checklist · ${checklist.title} · ${islandStatusLabel(status)}`}
          aria-label={`Voltar ao checklist, ${checklist.completed} de ${checklist.total}`}
          onClick={onResumeChecklist}
          className={cn(
            "flex h-6 shrink-0 items-center gap-1 rounded-full px-1.5 outline-none",
            "font-technical text-[10px] font-medium tabular-nums text-foreground",
            "transition-colors duration-150 hover:bg-surface-hover",
            "focus-visible:bg-surface-hover focus-visible:inset-ring-1 focus-visible:inset-ring-hairline-strong",
          )}
        >
          <span role="status" aria-label={islandStatusLabel(status)}>
            {statusDot}
          </span>
          {checklist.completed}/{checklist.total}
        </button>
      ) : (
        <span
          data-overlay-hit
          className="grid size-3 shrink-0 place-items-center"
          title={islandStatusLabel(status)}
          aria-label={islandStatusLabel(status)}
          role="status"
        >
          {statusDot}
        </span>
      )}

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
    </div>
  );
}
