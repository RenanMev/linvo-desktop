import { describe, expect, it } from "vitest";

import {
  PROCEDURE_RECORD_MAX_MS,
  PROCEDURE_RECORD_WARN_MS,
  formatRecordingClock,
  recorderPhaseForElapsed,
} from "@/lib/procedure/procedure-recorder";

describe("procedure-recorder timing", () => {
  it("warns near 1:30 and stops at 2:00", () => {
    expect(recorderPhaseForElapsed(0)).toBe("recording");
    expect(recorderPhaseForElapsed(PROCEDURE_RECORD_WARN_MS - 1)).toBe(
      "recording",
    );
    expect(recorderPhaseForElapsed(PROCEDURE_RECORD_WARN_MS)).toBe(
      "near_limit",
    );
    expect(recorderPhaseForElapsed(PROCEDURE_RECORD_MAX_MS)).toBe(
      "awaiting_confirm",
    );
  });

  it("formats elapsed clock up to 2:00", () => {
    expect(formatRecordingClock(0)).toBe("0:00");
    expect(formatRecordingClock(90_000)).toBe("1:30");
    expect(formatRecordingClock(120_000)).toBe("2:00");
    expect(formatRecordingClock(150_000)).toBe("2:00");
  });
});
