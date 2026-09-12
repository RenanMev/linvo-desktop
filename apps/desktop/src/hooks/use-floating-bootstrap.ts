import { useEffect, useRef, useState } from "react";

import { enterFloatingMode } from "@/lib/auth/enter-floating-mode";
import type { IslandGrowthDirection } from "@/lib/window-mode";

export type FloatingBootstrap = {
  ready: boolean;
  /**
   * Direção de crescimento do envelope (ver `docs/SDD-ILHA-ENVELOPE.md`),
   * resolvida uma vez por `enterFloatingMode` e usada por toda a sessão.
   * "down" até `ready`, e como reserva se `enterFloatingMode` falhar —
   * mesmo padrão de `resolveIslandGrowthDirection` sem monitor conhecido.
   */
  growth: IslandGrowthDirection;
};

export function useFloatingBootstrap(): FloatingBootstrap {
  const [ready, setReady] = useState(false);
  const [growth, setGrowth] = useState<IslandGrowthDirection>("down");
  const taskRef = useRef<Promise<IslandGrowthDirection> | null>(null);

  useEffect(() => {
    let active = true;

    if (!taskRef.current) {
      taskRef.current = enterFloatingMode().catch((error) => {
        console.error("enterFloatingMode failed", error);
        return "down" as const;
      });
    }

    void taskRef.current
      .then((resolvedGrowth) => {
        if (active) {
          setGrowth(resolvedGrowth);
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { ready, growth };
}
