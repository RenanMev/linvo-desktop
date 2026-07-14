import { useEffect, useState } from "react";

import { checkApiHealth } from "@/lib/api-health";

const POLL_INTERVAL_MS = 30_000;

export function useApiHealth(enabled: boolean): boolean {
  const [healthy, setHealthy] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHealthy(false);
      return;
    }

    let active = true;

    async function poll() {
      const result = await checkApiHealth();
      if (active) {
        setHealthy(result.ok);
      }
    }

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled]);

  return healthy;
}
