import type { UserPublic } from "@linvo/shared";
import { Minus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hideAllWindows } from "@/lib/app-windows";

export function OnboardingTitlebar({ user }: { user: UserPublic }) {
  const initials = user.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center justify-end gap-3 border-b border-hairline px-3"
    >
      <span
        title={user.name}
        className="grid size-6 place-items-center rounded-md bg-surface-raise-2 font-technical text-[10px] font-semibold text-foreground"
      >
        {initials || "?"}
      </span>
      <span className="h-4 w-px bg-surface-raise-2" aria-hidden />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Minimizar"
        onClick={() => void hideAllWindows()}
      >
        <Minus className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Fechar"
        className="hover:bg-destructive hover:text-white"
        onClick={() => void hideAllWindows()}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
