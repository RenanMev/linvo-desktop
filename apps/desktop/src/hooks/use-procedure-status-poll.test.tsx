import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProcedureStatusPoll } from "@/hooks/use-procedure-status-poll";
import * as procedureApi from "@/lib/procedure/procedure-api";

vi.mock("@/lib/procedure/procedure-api", () => ({
  listProcedures: vi.fn(),
}));

vi.mock("@/lib/desktop-notifications", () => ({
  notifyDesktopEvent: vi.fn(),
}));

describe("useProcedureStatusPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifies when processing becomes pending_review or failed", async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn();

    vi.mocked(procedureApi.listProcedures)
      .mockResolvedValueOnce([
        {
          id: "proc-1",
          workspaceId: "ws-1",
          status: "PROCESSING",
          title: null,
          slug: null,
          markdown: null,
          steps: null,
          retainVideo: false,
          videoPath: null,
          error: null,
          attemptCount: 0,
          createdAt: "2026-07-21T12:00:00.000Z",
          updatedAt: "2026-07-21T12:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "proc-1",
          workspaceId: "ws-1",
          status: "PENDING_REVIEW",
          title: "Pronto",
          slug: null,
          markdown: "## Título / tema\n\nx",
          steps: null,
          retainVideo: false,
          videoPath: null,
          error: null,
          attemptCount: 1,
          createdAt: "2026-07-21T12:00:00.000Z",
          updatedAt: "2026-07-21T12:01:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "proc-2",
          workspaceId: "ws-1",
          status: "PROCESSING",
          title: null,
          slug: null,
          markdown: null,
          steps: null,
          retainVideo: false,
          videoPath: null,
          error: null,
          attemptCount: 0,
          createdAt: "2026-07-21T12:00:00.000Z",
          updatedAt: "2026-07-21T12:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "proc-2",
          workspaceId: "ws-1",
          status: "FAILED",
          title: null,
          slug: null,
          markdown: null,
          steps: null,
          retainVideo: false,
          videoPath: null,
          error: "tentativa 3/3: falha",
          attemptCount: 3,
          createdAt: "2026-07-21T12:00:00.000Z",
          updatedAt: "2026-07-21T12:02:00.000Z",
        },
      ]);

    renderHook(() =>
      useProcedureStatusPoll("ws-1", {
        intervalMs: 1000,
        notify,
        onUpdate,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(notify).toHaveBeenCalledWith(
      "Markdown do procedure pronto para revisão.",
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(notify).toHaveBeenCalledWith(
      "Falha no processamento do procedure.",
    );
    expect(onUpdate).toHaveBeenCalled();
  });
});
