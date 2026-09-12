import { invoke } from "@tauri-apps/api/core";
import { Window } from "@tauri-apps/api/window";

import { islandLog } from "@/lib/island-debug";

export type OverlayBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlayChromeStatus = {
  noActivateOk: boolean;
  clickThrough: boolean;
  excludeFromCapture: boolean;
  topmostGuard: boolean;
  win32Ok: boolean;
};

const MAIN_LABEL = "main";

let cachedStatus: OverlayChromeStatus | null = null;
let lastClickThroughKey: string | null = null;

export function getCachedOverlayChromeStatus(): OverlayChromeStatus | null {
  return cachedStatus;
}

export function resetOverlayChromeCache(): void {
  cachedStatus = null;
  lastClickThroughKey = null;
}

function rememberStatus(status: OverlayChromeStatus): OverlayChromeStatus {
  cachedStatus = status;
  return status;
}

/*
 * Um comando `Result<(), String>` resolve como `null` no sucesso, então "deu
 * null" não pode significar "falhou": era isso que fazia `showWindowNoActivate`
 * cair no fallback `show()` sempre e devolver o roubo de foco que o KAN-10
 * existe para tirar.
 */
type ChromeResult<T> = { ok: true; value: T } | { ok: false };

async function invokeChrome<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<ChromeResult<T>> {
  try {
    const value =
      payload === undefined
        ? await invoke<T>(command)
        : await invoke<T>(command, payload);
    return { ok: true, value };
  } catch (error) {
    islandLog(`overlay-chrome:${command}:FAILED`, { error: String(error) });
    return { ok: false };
  }
}

async function fallbackShowNoActivate(): Promise<void> {
  try {
    const main = await Window.getByLabel(MAIN_LABEL);
    await main?.show();
  } catch (error) {
    islandLog("overlay-chrome:show:FALLBACK_FAILED", { error: String(error) });
  }
}

function canUseNoActivate(status: OverlayChromeStatus | null): boolean {
  if (!status) {
    return true;
  }
  return status.win32Ok && status.noActivateOk;
}

export function rectsToHoles(
  rects: Array<{ left: number; top: number; width: number; height: number }>,
  scaleFactor: number,
  viewportOffset: { x: number; y: number } = { x: 0, y: 0 },
): OverlayBounds[] {
  return rects
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: Math.round((rect.left + viewportOffset.x) * scaleFactor),
      y: Math.round((rect.top + viewportOffset.y) * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor),
    }));
}

export function readViewportOffset(): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }
  const viewport = window.visualViewport;
  if (!viewport) {
    return { x: 0, y: 0 };
  }
  return { x: viewport.offsetLeft, y: viewport.offsetTop };
}

export const OVERLAY_HIT_PADDING_PX = 6;

export function holesFromElements(
  elements: Array<Element | null | undefined>,
  scaleFactor: number,
): OverlayBounds[] {
  const offset = readViewportOffset();
  const pad = OVERLAY_HIT_PADDING_PX;
  const rects = elements
    .filter((element): element is Element => Boolean(element))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      left: rect.left - pad,
      top: rect.top - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    }));
  return rectsToHoles(rects, scaleFactor, offset);
}

export async function overlayChromeStatus(): Promise<OverlayChromeStatus | null> {
  const result = await invokeChrome<OverlayChromeStatus>("overlay_chrome_status");
  return result.ok ? rememberStatus(result.value) : null;
}

export async function showWindowNoActivate(): Promise<void> {
  if (!canUseNoActivate(cachedStatus)) {
    await fallbackShowNoActivate();
    return;
  }
  const result = await invokeChrome("show_window_no_activate");
  if (!result.ok) {
    await fallbackShowNoActivate();
  }
}

export async function setClickThrough(input: {
  enabled: boolean;
  holes: OverlayBounds[];
}): Promise<void> {
  const key = JSON.stringify(input);
  if (key === lastClickThroughKey) {
    return;
  }
  lastClickThroughKey = key;
  const result = await invokeChrome<OverlayChromeStatus>("set_click_through", {
    enabled: input.enabled,
    holes: input.holes,
  });
  if (!result.ok) {
    // Sem isso a falha ficava marcada como aplicada e a retentativa idêntica era
    // descartada pelo dedupe, deixando a ilha travada no estado errado.
    lastClickThroughKey = null;
    return;
  }
  rememberStatus(result.value);
}

export async function setExcludeFromCapture(enabled: boolean): Promise<void> {
  const result = await invokeChrome<OverlayChromeStatus>(
    "set_exclude_from_capture",
    { enabled },
  );
  if (result.ok) {
    rememberStatus(result.value);
  }
}

export async function setTopmostGuard(enabled: boolean): Promise<void> {
  const result = await invokeChrome<OverlayChromeStatus>("set_topmost_guard", {
    enabled,
  });
  if (result.ok) {
    rememberStatus(result.value);
  }
}
