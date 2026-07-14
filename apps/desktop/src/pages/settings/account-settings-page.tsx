import { ScrollArea } from "@/components/ui/scroll-area";
import type { PanelSession } from "@/hooks/use-panel-session";

type AccountSettingsPageProps = {
  session: PanelSession;
};

export function AccountSettingsPage({ session }: AccountSettingsPageProps) {
  const { user } = session;

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl px-8 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informações da sua conta conectada neste dispositivo.
        </p>
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nome
            </p>
            <p className="mt-1 text-sm">{user.name}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              E-mail
            </p>
            <p className="mt-1 text-sm">{user.email}</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
