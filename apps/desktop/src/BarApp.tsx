import type { UserPublic } from "@linvo/shared";

import { FloatingBar } from "@/components/floating-bar";
import { useApiHealth } from "@/hooks/use-api-health";
import { useFloatingBootstrap } from "@/hooks/use-floating-bootstrap";
import { useWindowPosition } from "@/hooks/use-window-position";
import { openPanel } from "@/lib/panel-window";

type BarAppProps = {
  sessionWarning: string | null;
  user: UserPublic;
};

export function BarApp({ sessionWarning, user }: BarAppProps) {
  const floatingReady = useFloatingBootstrap();
  const apiHealthy = useApiHealth(true);

  const isActive = floatingReady && apiHealthy && !sessionWarning;

  useWindowPosition({
    enabled: floatingReady,
    shouldPersist: () => true,
  });

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl">
      <FloatingBar
        isActive={isActive}
        onChat={() => void openPanel("/chat", user)}
        onOpenSettings={() => void openPanel("/settings/general", user)}
      />
    </div>
  );
}
