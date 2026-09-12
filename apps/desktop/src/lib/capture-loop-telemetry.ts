import { islandLog } from "@/lib/island-debug";

let captureStartedAt: number | null = null;

export function markCaptureStart(now = performance.now()): void {
  captureStartedAt = now;
  islandLog("capture-loop:start");
}

export function markCopyReady(now = performance.now()): number | null {
  if (captureStartedAt == null) {
    return null;
  }
  const ms = now - captureStartedAt;
  captureStartedAt = null;
  islandLog("capture-loop:copy-ready", { ms });
  return ms;
}

export function resetCaptureLoop(): void {
  captureStartedAt = null;
}
