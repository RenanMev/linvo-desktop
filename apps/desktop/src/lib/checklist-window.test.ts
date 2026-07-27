import { beforeEach, describe, expect, it } from "vitest";

import type { Procedure } from "@linvo/shared";

import {
  CHECKLIST_CLOSED_EVENT,
  CHECKLIST_DISMISS_EVENT,
  CHECKLIST_PAYLOAD_EVENT,
  CHECKLIST_PROGRESS_EVENT,
  closeChecklist,
  emitChecklistClosed,
  emitChecklistProgress,
  openChecklist,
  rememberChecklistConversation,
} from "@/lib/checklist-window";
import { emitMock, emitToMock, invokeMock, showMock } from "@/test/mocks/tauri";

const procedure: Procedure = {
  id: "proc-1",
  workspaceId: "ws-1",
  status: "PUBLISHED",
  title: "Número cancelado",
  slug: "numero_cancelado",
  markdown: null,
  steps: ["Validar pagamento", "Reativar linha"],
  retainVideo: false,
  videoPath: null,
  error: null,
  attemptCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("checklist-window", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    emitMock.mockReset();
    emitToMock.mockReset();
    showMock.mockClear();
    invokeMock.mockResolvedValue(undefined);
    emitMock.mockResolvedValue(undefined);
    emitToMock.mockResolvedValue(undefined);
    rememberChecklistConversation(null);
  });

  it("opens checklist on main floating bar and emits payload", async () => {
    const payload = {
      conversationId: "conv-1",
      procedure,
      progress: { completedStepIndexes: [0], currentStepIndex: 1 },
    };

    await openChecklist(payload);

    expect(showMock).toHaveBeenCalled();
    expect(emitToMock).toHaveBeenCalledWith(
      "main",
      CHECKLIST_PAYLOAD_EVENT,
      payload,
    );
    expect(invokeMock).not.toHaveBeenCalledWith("checklist_open");
  });

  it("closes checklist by dismissing main floating mode", async () => {
    rememberChecklistConversation("conv-1");
    await closeChecklist();

    expect(emitToMock).toHaveBeenCalledWith("main", CHECKLIST_DISMISS_EVENT, {
      conversationId: "conv-1",
    });
    expect(invokeMock).not.toHaveBeenCalledWith("checklist_close");
  });

  it("does nothing when no checklist conversation is active", async () => {
    await closeChecklist({ emitClosed: true });

    expect(emitToMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("closes checklist and emits closed when requested", async () => {
    rememberChecklistConversation("conv-1");

    await closeChecklist({ emitClosed: true });

    expect(emitToMock).toHaveBeenCalledWith("main", CHECKLIST_DISMISS_EVENT, {
      conversationId: "conv-1",
    });
    expect(emitMock).toHaveBeenCalledWith(CHECKLIST_CLOSED_EVENT, {
      conversationId: "conv-1",
    });
  });

  it("emits progress and closed events", async () => {
    await emitChecklistProgress({
      conversationId: "conv-1",
      progress: { completedStepIndexes: [0], currentStepIndex: 1 },
    });
    await emitChecklistClosed({ conversationId: "conv-1" });

    expect(emitMock).toHaveBeenCalledWith(CHECKLIST_PROGRESS_EVENT, {
      conversationId: "conv-1",
      progress: { completedStepIndexes: [0], currentStepIndex: 1 },
    });
    expect(emitMock).toHaveBeenCalledWith(CHECKLIST_CLOSED_EVENT, {
      conversationId: "conv-1",
    });
  });
});
