import { ScrollArea } from "@/components/ui/scroll-area";
import type { PanelSession } from "@/hooks/use-panel-session";

type AccountSettingsPageProps = {
  session: PanelSession;
};

export function AccountSettingsPage({ session }: AccountSettingsPageProps) {
  const { user } = session;

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Conta</h1>
          <p className="text-xs text-muted-foreground">
            Informações da sua conta conectada neste dispositivo.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Nome
            </p>
            <p className="mt-0.5 text-xs font-medium">{user.name}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              E-mail
            </p>
            <p className="mt-0.5 text-xs font-medium">{user.email}</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
