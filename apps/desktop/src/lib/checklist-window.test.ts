import { beforeEach, describe, expect, it } from "vitest";

import type { Procedure } from "@linvo/shared";

import {
  CHECKLIST_CLOSED_EVENT,
  CHECKLIST_PAYLOAD_EVENT,
  CHECKLIST_PROGRESS_EVENT,
  closeChecklist,
  emitChecklistClosed,
  emitChecklistProgress,
  openChecklist,
} from "@/lib/checklist-window";
import { emitMock, emitToMock, invokeMock } from "@/test/mocks/tauri";

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
    invokeMock.mockResolvedValue(undefined);
    emitMock.mockResolvedValue(undefined);
    emitToMock.mockResolvedValue(undefined);
  });

  it("opens checklist and emits payload", async () => {
    const payload = {
      conversationId: "conv-1",
      procedure,
      progress: { completedStepIndexes: [0], currentStepIndex: 1 },
    };

    await openChecklist(payload);

    expect(invokeMock).toHaveBeenCalledWith("checklist_open");
    expect(emitToMock).toHaveBeenCalledWith(
      "checklist",
      CHECKLIST_PAYLOAD_EVENT,
      payload,
    );
  });

  it("closes checklist", async () => {
    await closeChecklist();

    expect(invokeMock).toHaveBeenCalledWith("checklist_close");
  });

  it("closes checklist and emits closed when requested", async () => {
    const { rememberChecklistConversation } = await import(
      "@/lib/checklist-window"
    );
    rememberChecklistConversation("conv-1");

    await closeChecklist({ emitClosed: true });

    expect(emitMock).toHaveBeenCalledWith(CHECKLIST_CLOSED_EVENT, {
      conversationId: "conv-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("checklist_close");
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
