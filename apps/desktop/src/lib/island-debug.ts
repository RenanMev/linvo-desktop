/*
 * Instrumentação do morph da ilha.
 *
 * Ligue no DevTools do WebView2 com:
 *   localStorage.setItem("linvo:debug-island", "1"); location.reload();
 * Desligue com:
 *   localStorage.removeItem("linvo:debug-island"); location.reload();
 *
 * O objetivo é separar três relógios que normalmente se confundem:
 *  - quando o `SetWindowPos` nativo retorna (marca `native:*`);
 *  - quando o WebView2 realmente entrega o viewport novo (`viewport`);
 *  - quando o CSS começa/termina de animar (`morph:*`).
 * O flicker mora exatamente na folga entre eles.
 */

const STORAGE_KEY = "linvo:debug-island";

type IslandDebugWindow = Window & {
  __islandDebug?: boolean;
};

/*
 * Lido a cada chamada, nunca memoizado: assim `__islandDebug = true` no console
 * passa a valer no próximo morph, sem reload. O reload perde o estado da janela
 * (modo, posição) e com ele metade dos cenários que queremos observar.
 */
export function islandDebugEnabled(): boolean {
  const override = (window as IslandDebugWindow).__islandDebug;
  if (typeof override === "boolean") {
    return override;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function stamp(): string {
  return `t=${performance.now().toFixed(1)}ms`;
}

function viewport(): string {
  return `vp=${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}`;
}

export function islandLog(event: string, detail?: Record<string, unknown>) {
  if (!islandDebugEnabled()) return;
  const parts = [`[island] ${event}`, stamp(), viewport()];
  if (detail) {
    parts.push(JSON.stringify(detail));
  }
  // eslint-disable-next-line no-console
  console.log(parts.join(" | "));
}

/**
 * Amostra o viewport a cada frame durante `durationMs`.
 *
 * É a sonda central: se o viewport só assume o tamanho final vários frames
 * depois do `SetWindowPos` ter retornado, a janela passou esses frames maior
 * que a superfície pintada pelo WebView2 — e, numa janela transparente, essa
 * faixa descoberta é o flicker.
 */
export function sampleViewportFrames(label: string, durationMs: number) {
  if (!islandDebugEnabled()) return;

  const start = performance.now();
  const samples: string[] = [];
  let last = "";

  const tick = () => {
    const now = performance.now();
    const current = `${window.innerWidth}x${window.innerHeight}`;
    if (current !== last) {
      samples.push(`+${(now - start).toFixed(1)}ms ${current}`);
      last = current;
    }
    if (now - start < durationMs) {
      window.requestAnimationFrame(tick);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[island] viewport-timeline ${label} | frames=${samples.length} | ${samples.join(" -> ")}`,
    );
  };

  window.requestAnimationFrame(tick);
}
