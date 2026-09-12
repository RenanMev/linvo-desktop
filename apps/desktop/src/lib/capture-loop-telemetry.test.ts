import { afterEach, describe, expect, it, vi } from "vitest";

import {
  markCaptureStart,
  markCopyReady,
  resetCaptureLoop,
} from "@/lib/capture-loop-telemetry";
import * as islandDebug from "@/lib/island-debug";

describe("capture loop telemetry", () => {
  afterEach(() => {
    resetCaptureLoop();
    vi.restoreAllMocks();
  });

  it("measures capture_start to copy_ready", () => {
    const log = vi.spyOn(islandDebug, "islandLog").mockImplementation(() => undefined);

    markCaptureStart(1_000);
    const ms = markCopyReady(4_250);

    expect(ms).toBe(3_250);
    expect(log).toHaveBeenCalledWith("capture-loop:start");
    expect(log).toHaveBeenCalledWith("capture-loop:copy-ready", { ms: 3_250 });
  });

  it("does not invent a duration without a capture start", () => {
    expect(markCopyReady(9_000)).toBeNull();
  });

  it("clears the loop so a second copy_ready is ignored", () => {
    markCaptureStart(10);
    expect(markCopyReady(20)).toBe(10);
    expect(markCopyReady(40)).toBeNull();
  });
});
