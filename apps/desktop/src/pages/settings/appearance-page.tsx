import { ScrollArea } from "@/components/ui/scroll-area";
import { AccentGroup } from "@/pages/settings/appearance/accent-group";
import { SurfaceGroup } from "@/pages/settings/appearance/surface-group";

export function AppearancePage() {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Aparência</h1>
          <p className="text-xs text-muted-foreground">
            Personalize tema, superfície, tipografia e densidade do Linvo.
          </p>
        </div>
        <div className="mt-6 space-y-6">
          <AccentGroup />
          <SurfaceGroup />
        </div>
      </div>
    </ScrollArea>
  );
}
