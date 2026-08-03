import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProcedureRecorder } from "@/hooks/use-procedure-recorder";
import {
  PROCEDURE_RECORD_MAX_MS,
  PROCEDURE_RECORD_WARN_MS,
} from "@/lib/procedure/procedure-recorder";

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["chunk"], { type: "video/webm" }) });
    this.onstop?.();
  }
}

describe("useProcedureRecorder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("warns at 1:30 and auto-stops at 2:00 awaiting confirm", async () => {
    let current = 0;
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;

    const { result } = renderHook(() =>
      useProcedureRecorder({
        startDisplayMedia: async () => stream,
        now: () => current,
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.phase).toBe("recording");

    current = PROCEDURE_RECORD_WARN_MS;
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.phase).toBe("near_limit");
    expect(result.current.elapsedLabel).toBe("1:30");

    current = PROCEDURE_RECORD_MAX_MS;
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.phase).toBe("awaiting_confirm");
    expect(result.current.recordedBlob).toBeInstanceOf(Blob);
  });

  it("keeps retainVideo selection for upload", async () => {
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;

    const { result } = renderHook(() =>
      useProcedureRecorder({
        startDisplayMedia: async () => stream,
        now: () => 0,
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.setRetainVideo(true);
      result.current.stop();
    });

    expect(result.current.phase).toBe("awaiting_confirm");
    expect(result.current.retainVideo).toBe(true);
  });
});
