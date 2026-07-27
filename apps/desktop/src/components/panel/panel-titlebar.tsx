import { Copy, Minus, Square, X } from "lucide-react";

import { AccountMenu } from "@/components/panel/account-menu";
import { Button } from "@/components/ui/button";
import type { PanelSession } from "@/hooks/use-panel-session";
import { showMainBar } from "@/lib/app-windows";
import { closePanel } from "@/lib/panel-window";

/**
 * Minimizar fecha apenas o painel: a barra flutuante continua na tela.
 * (Antes chamava hideAllWindows(), que derrubava barra + checklist junto.)
 */
async function minimizePanelKeepingBar(): Promise<void> {
  await closePanel();
  await showMainBar();
}

type PanelTitlebarProps = {
  session: PanelSession;
  maximized: boolean;
  onToggleMaximize: () => void | Promise<void>;
};

export function PanelTitlebar({
  session,
  maximized,
  onToggleMaximize,
}: PanelTitlebarProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-2">
      <div
        data-tauri-drag-region
        className="h-full min-w-0 flex-1"
        onDoubleClick={() => void onToggleMaximize()}
      />
      <div className="flex items-center gap-1">
        <AccountMenu session={session} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void minimizePanelKeepingBar()}
          title="Minimizar"
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void onToggleMaximize()}
          title={maximized ? "Restaurar" : "Maximizar"}
        >
          {maximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
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
