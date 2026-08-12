import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type CaptureSourceKind = "window" | "monitor";

export type CaptureSource = {
  id: string;
  kind: CaptureSourceKind;
  title: string;
  appName: string;
  width: number;
  height: number;
  thumbnail: string;
};

export type CaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SnapRectKind = "window" | "monitor";

/**
 * Alvo de magnetismo em pixels físicos absolutos da área de trabalho virtual.
 * Vem pronto do Rust: enumerar isto no front, com o overlay já na frente de
 * tudo, só devolveria o próprio overlay.
 */
export type SnapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: SnapRectKind;
  title: string;
};

export type OverlayPayload = {
  width: number;
  height: number;
  originX: number;
  originY: number;
  snapRects: SnapRect[];
};

export const OVERLAY_READY_EVENT = "capture-overlay://ready";
export const OVERLAY_RESULT_EVENT = "capture-overlay://result";
export const OVERLAY_CANCEL_EVENT = "capture-overlay://cancel";

/** Só a região: os pixels ficam no Rust e saem de lá já recortados. */
export type OverlayResult = {
  region: CaptureRect;
};

export async function listCaptureSources(
  kind: CaptureSourceKind | "all" = "all",
): Promise<CaptureSource[]> {
  return invoke<CaptureSource[]>("capture_list_sources", {
    kind: kind === "all" ? null : kind,
  });
}

export async function captureSourceBytes(id: string): Promise<Uint8Array> {
  const response = await invoke<ArrayBuffer | number[]>("capture_source", { id });
  if (response instanceof ArrayBuffer) {
    return new Uint8Array(response);
  }
  return Uint8Array.from(response);
}

export async function captureSourceMeta(
  id: string,
): Promise<Pick<CaptureSource, "id" | "kind" | "title" | "width" | "height">> {
  return invoke("capture_source_meta", { id });
}

export async function openCaptureOverlay(): Promise<void> {
  await invoke("capture_overlay_open");
}

async function invokeBytes(
  command: string,
  args?: Record<string, unknown>,
): Promise<Uint8Array> {
  const response = await invoke<ArrayBuffer | number[]>(command, args);
  if (response instanceof ArrayBuffer) {
    return new Uint8Array(response);
  }
  return Uint8Array.from(response);
}

/** Recorte final, já cortado no Rust: chegam KB em vez do desktop inteiro. */
export async function fetchOverlayCrop(region: CaptureRect): Promise<Blob> {
  return bytesToPngBlob(await invokeBytes("capture_overlay_crop", { region }));
}

export async function closeCaptureOverlay(): Promise<void> {
  await invoke("capture_overlay_close");
}

export function listenOverlayReady(
  handler: (payload: OverlayPayload) => void,
): Promise<UnlistenFn> {
  return listen<OverlayPayload>(OVERLAY_READY_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenOverlayResult(
  handler: (payload: OverlayResult) => void,
): Promise<UnlistenFn> {
  return listen<OverlayResult>(OVERLAY_RESULT_EVENT, (event) => {
    handler(event.payload);
  });
}

export function listenOverlayCancel(handler: () => void): Promise<UnlistenFn> {
  return listen(OVERLAY_CANCEL_EVENT, () => {
    handler();
  });
}

export function bytesToPngBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: "image/png" });
}

export function base64ToPngBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytesToPngBlob(bytes);
}
