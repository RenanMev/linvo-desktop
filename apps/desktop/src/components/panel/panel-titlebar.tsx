import { Minus, X } from "lucide-react";

import { AccountMenu } from "@/components/panel/account-menu";
import { Button } from "@/components/ui/button";
import type { PanelSession } from "@/hooks/use-panel-session";
import { hideAllWindows } from "@/lib/app-windows";
import { closePanel } from "@/lib/panel-window";

type PanelTitlebarProps = {
  session: PanelSession;
};

export function PanelTitlebar({ session }: PanelTitlebarProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-2">
      <div data-tauri-drag-region className="h-full min-w-0 flex-1" />
      <div className="flex items-center gap-1">
        <AccountMenu session={session} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void hideAllWindows()}
          title="Minimizar"
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void closePanel()}
          title="Fechar"
          className="hover:bg-destructive hover:text-white"
        >
          <X />
        </Button>
      </div>
    </header>
  );
}
