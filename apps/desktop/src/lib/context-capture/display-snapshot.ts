export const DISPLAY_SNAPSHOT_MAX_DIMENSION = 2048;
export const DISPLAY_SNAPSHOT_MAX_BYTES = 5 * 1024 * 1024;

export type DisplaySnapshot = {
  blob: Blob;
  mimeType: "image/png" | "image/jpeg";
  filename: string;
  width: number;
  height: number;
  sourceLabel?: string;
};

export type StartDisplayMedia = () => Promise<MediaStream>;

export class DisplaySnapshotCancelledError extends Error {
  constructor() {
    super("Display snapshot cancelled");
    this.name = "DisplaySnapshotCancelledError";
  }
}

type CaptureDisplaySnapshotOptions = {
  startDisplayMedia?: StartDisplayMedia;
  maxDimension?: number;
  maxBytes?: number;
  now?: () => Date;
  waitForFrame?: (video: HTMLVideoElement) => Promise<void>;
};

const defaultStartDisplayMedia: StartDisplayMedia = () =>
  navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });

function isCancellationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === "NotAllowedError" ||
    error.name === "AbortError" ||
    error.name === "NotFoundError"
  );
}

function formatSnapshotFilename(date: Date, extension: "png" | "jpg"): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
  return `context-${stamp}.${extension}`;
}

function resolveDrawSize(
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  const largest = Math.max(sourceWidth, sourceHeight);
  if (largest <= maxDimension) {
    return { width: sourceWidth, height: sourceHeight };
  }
  const scale = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

async function defaultWaitForFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Falha ao carregar o frame capturado"));
      };
      const cleanup = () => {
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadeddata", onLoaded);
      video.addEventListener("error", onError);
    });
  }

  await video.play().catch(() => undefined);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/png" | "image/jpeg",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível gerar a imagem capturada"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export async function captureDisplaySnapshot(
  options: CaptureDisplaySnapshotOptions = {},
): Promise<DisplaySnapshot> {
  const startDisplayMedia =
    options.startDisplayMedia ?? defaultStartDisplayMedia;
  const maxDimension = options.maxDimension ?? DISPLAY_SNAPSHOT_MAX_DIMENSION;
  const maxBytes = options.maxBytes ?? DISPLAY_SNAPSHOT_MAX_BYTES;
  const now = options.now ?? (() => new Date());
  const waitForFrame = options.waitForFrame ?? defaultWaitForFrame;

  let stream: MediaStream | null = null;

  try {
    stream = await startDisplayMedia();
  } catch (error) {
    if (isCancellationError(error)) {
      throw new DisplaySnapshotCancelledError();
    }
    throw error;
  }

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await waitForFrame(video);

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error("Captura inválida: dimensões zeradas");
    }

    const { width, height } = resolveDrawSize(
      sourceWidth,
      sourceHeight,
      maxDimension,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D indisponível");
    }
    context.drawImage(video, 0, 0, width, height);

    let mimeType: "image/png" | "image/jpeg" = "image/png";
    let blob = await canvasToBlob(canvas, mimeType);
    if (blob.size > maxBytes) {
      mimeType = "image/jpeg";
      blob = await canvasToBlob(canvas, mimeType, 0.85);
    }

    const extension = mimeType === "image/png" ? "png" : "jpg";
    const trackLabel = stream.getVideoTracks()[0]?.label?.trim();

    return {
      blob,
      mimeType,
      filename: formatSnapshotFilename(now(), extension),
      width,
      height,
      ...(trackLabel ? { sourceLabel: trackLabel } : {}),
    };
  } finally {
    video.srcObject = null;
    stream.getTracks().forEach((track) => track.stop());
  }
}

export function resolveDrawSizeForTests(
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
) {
  return resolveDrawSize(sourceWidth, sourceHeight, maxDimension);
}
