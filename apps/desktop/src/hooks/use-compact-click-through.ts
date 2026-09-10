import { useEffect } from "react";

import type { FloatingIslandMode } from "@/components/floating-island-shell";
import {
  holesFromElements,
  setClickThrough,
} from "@/lib/overlay-chrome";

export const OVERLAY_HIT_SELECTOR = "[data-overlay-hit]";

export function useCompactClickThrough(input: {
  mode: FloatingIslandMode;
  suspended: boolean;
}): void {
  const { mode, suspended } = input;

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    let mutations: MutationObserver | null = null;

    const passthroughOff =
      suspended || (mode !== "compact" && mode !== "edge-collapsed");

    async function publish() {
      if (passthroughOff) {
        await setClickThrough({ enabled: false, holes: [] });
        return;
      }

      const scale =
        typeof window !== "undefined" && window.devicePixelRatio
          ? window.devicePixelRatio
          : 1;
      const nodes = Array.from(
        document.querySelectorAll(OVERLAY_HIT_SELECTOR),
      );
      const holes = holesFromElements(nodes, scale);
      if (holes.length === 0) {
        await setClickThrough({ enabled: false, holes: [] });
        return;
      }
      if (cancelled) {
        await setClickThrough({ enabled: false, holes: [] });
        return;
      }
      await setClickThrough({ enabled: true, holes });
      if (cancelled) {
        await setClickThrough({ enabled: false, holes: [] });
      }
    }

    function schedule() {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        void publish();
      });
    }

    schedule();

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => schedule());
      observer.observe(document.documentElement);
    }
    /*
     * A janela tem tamanho fixo, então o ResizeObserver sozinho não vê alvo que
     * entra, sai ou muda de lugar dentro da barra — e um hole desatualizado é um
     * clique perdido para o app de baixo. O rAF já agrupa a rajada.
     */
    if (!passthroughOff && typeof MutationObserver !== "undefined") {
      mutations = new MutationObserver(() => schedule());
      mutations.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    window.addEventListener("resize", schedule);

    return () => {
      cancelled = true;
      if (frame) {
        cancelAnimationFrame(frame);
      }
      observer?.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", schedule);
      void setClickThrough({ enabled: false, holes: [] });
    };
  }, [mode, suspended]);
}
