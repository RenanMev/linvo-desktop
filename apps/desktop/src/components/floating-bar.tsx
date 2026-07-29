import {
  Minimize2,
  Minus,
  GripVertical,
  MessageSquare,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Ref } from "react";

import { cn } from "@/lib/utils";

type FloatingBarProps = {
  isActive: boolean;
  onOpenQuickMenu: () => void;
  onCollapseToEdge: () => void;
  onMinimize: () => void;
  chatButtonRef?: Ref<HTMLButtonElement>;
};

function BarDivider() {
  return <span className="h-3.5 w-px shrink-0 bg-surface-raise-2" aria-hidden />;
}

function BarAction({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  buttonRef,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full outline-none",
        "text-foreground transition-all duration-150",
        "[&_svg]:size-3.5 [&_svg]:opacity-50 [&_svg]:transition-opacity",
        "hover:bg-surface-hover hover:[&_svg]:opacity-100",
        "focus-visible:ring-2 focus-visible:ring-ring/40",
        "active:scale-95",
        "disabled:pointer-events-none disabled:[&_svg]:opacity-20",
      )}
    >
      <Icon />
    </button>
  );
}

export function FloatingBar({
  isActive,
  onOpenQuickMenu,
  onCollapseToEdge,
  onMinimize,
  chatButtonRef,
}: FloatingBarProps) {
  return (
    <div className="flex h-full w-full items-center gap-1 px-1.5">
      <span
        data-tauri-drag-region
        title="Mover"
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

      <BarAction
        icon={MessageSquare}
        label="Chat"
        onClick={onOpenQuickMenu}
        buttonRef={chatButtonRef}
      />
      <BarAction icon={Video} label="Gravar · em breve" disabled />
      <BarAction icon={Minimize2} label="Encolher" onClick={onCollapseToEdge} />
      <BarAction icon={Minus} label="Minimizar" onClick={onMinimize} />
    </div>
  );
}
