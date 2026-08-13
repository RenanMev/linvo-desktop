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

/**
 * Lista as fontes **sem** miniatura — só metadata, que é barata. As miniaturas
 * chegam depois, uma por linha, via `captureSourceThumbnail`: montá-las aqui
 * significava capturar e codificar em PNG toda janela e todo monitor aberto
 * antes do seletor pintar qualquer coisa.
 */
export async function listCaptureSources(
  kind: CaptureSourceKind | "all" = "all",
): Promise<CaptureSource[]> {
  return invoke<CaptureSource[]>("capture_list_sources", {
    kind: kind === "all" ? null : kind,
  });
}

export async function captureSourceThumbnail(id: string): Promise<string> {
  return invoke<string>("capture_source_thumbnail", { id });
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

export async function captureSourceBytes(id: string): Promise<Uint8Array> {
  return invokeBytes("capture_source", { id });
}

export async function openCaptureOverlay(): Promise<void> {
  await invoke("capture_overlay_open");
}

/** Payload da sessão em voo, para quando o evento `ready` se perde. */
export async function fetchOverlayPayload(): Promise<OverlayPayload | null> {
  return invoke<OverlayPayload | null>("capture_overlay_payload");
}

/**
 * Captura só a região escolhida, direto dos monitores. Chegam KB, e nada é
 * capturado na abertura do overlay.
 *
 * É este comando que devolve as janelas escondidas — depois de já ter
 * capturado, para o chat não reaparecer a tempo de sair dentro do print.
 */
export async function fetchOverlayCrop(
  region: CaptureRect,
  focus?: string,
): Promise<Blob> {
  return bytesToPngBlob(
    await invokeBytes("capture_overlay_region", {
      region,
      focus: focus ?? null,
    }),
  );
}

/**
 * `focus`: janela que pediu a captura, para o foco voltar para ela.
 * `restore: false` no confirm, onde quem devolve as janelas é `fetchOverlayCrop`.
 */
export async function closeCaptureOverlay(
  focus?: string,
  options?: { restore?: boolean },
): Promise<void> {
  await invoke("capture_overlay_close", {
    focus: focus ?? null,
    restore: options?.restore ?? true,
  });
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
