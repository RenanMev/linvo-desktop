import { ScrollArea } from "@/components/ui/scroll-area";

export function GeneralSettingsPage() {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl px-8 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Geral</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Preferências gerais do assistente. Novas opções serão adicionadas aqui.
        </p>
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-sm font-medium">Aparência</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O tema segue a preferência do sistema operacional.
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-sm font-medium">Atalho global</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use Ctrl+Shift+L para mostrar ou ocultar a barra flutuante.
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
