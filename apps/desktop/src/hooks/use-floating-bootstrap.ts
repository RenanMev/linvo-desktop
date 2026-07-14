import { useEffect, useRef, useState } from "react";

import { enterFloatingMode } from "@/lib/auth/enter-floating-mode";

export function useFloatingBootstrap() {
  const [ready, setReady] = useState(false);
  const taskRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;

    if (!taskRef.current) {
      taskRef.current = enterFloatingMode().catch((error) => {
        console.error("enterFloatingMode failed", error);
      });
    }

    void taskRef.current.finally(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return ready;
}
