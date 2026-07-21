export const PROCEDURE_RECORD_WARN_MS = 90_000;
export const PROCEDURE_RECORD_MAX_MS = 120_000;

export type ProcedureRecorderPhase =
  | "idle"
  | "recording"
  | "near_limit"
  | "awaiting_confirm";

export function recorderPhaseForElapsed(elapsedMs: number): ProcedureRecorderPhase {
  if (elapsedMs >= PROCEDURE_RECORD_MAX_MS) {
    return "awaiting_confirm";
  }
  if (elapsedMs >= PROCEDURE_RECORD_WARN_MS) {
    return "near_limit";
  }
  return "recording";
}

export function formatRecordingClock(elapsedMs: number): string {
  const totalSeconds = Math.min(
    Math.floor(elapsedMs / 1000),
    Math.floor(PROCEDURE_RECORD_MAX_MS / 1000),
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
