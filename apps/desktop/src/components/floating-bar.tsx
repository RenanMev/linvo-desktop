import { GripVertical, MessageSquare, Minus, Settings, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hideAllWindows } from "@/lib/app-windows";
import { cn } from "@/lib/utils";

type FloatingBarProps = {
  isActive: boolean;
  onChat?: () => void;
  onOpenSettings: () => void;
  disabled?: boolean;
};

export function FloatingBar({
  isActive,
  onChat,
  onOpenSettings,
  disabled = false,
}: FloatingBarProps) {
  return (
    <div className="flex h-full w-full items-center justify-start gap-0 px-1">
      <span
        data-tauri-drag-region
        title="Mover"
        className="flex h-6 shrink-0 cursor-grab items-center rounded-md px-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
      >
        <GripVertical className="pointer-events-none size-3" />
      </span>

      <span
        className="flex size-4 shrink-0 items-center justify-center"
        title={isActive ? "Sistema ativo" : "Sistema inativo"}
      >
        <span
          className={cn(
            "size-2 rounded-full transition-colors",
            isActive
              ? "bg-green-500 shadow-[0_0_4px_1px] shadow-green-500/60"
              : "bg-transparent",
          )}
        />
      </span>

      <Button variant="ghost" size="icon-xs" onClick={onChat} title="Chat">
        <MessageSquare />
      </Button>
      <Button variant="ghost" size="icon-xs" disabled title="Em breve">
        <Video />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onOpenSettings}
        title="Configurações"
        disabled={disabled}
      >
        <Settings />
      </Button>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => void hideAllWindows()}
        title="Minimizar"
      >
        <Minus />
      </Button>
    </div>
  );
}
