import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ASSIST_CONTINUE_EVENT,
  ASSIST_CONTINUE_RESULT_EVENT,
  acceptAssistContinue,
  assistContinueRejectMessage,
  continueInAssist,
  listenAssistContinue,
  listenAssistContinueResult,
  rejectAssistContinue,
} from "@/lib/assist-handoff";
import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/chat/active-conversation-store";
import { emitToMock, listenMock } from "@/test/mocks/tauri";

describe("assist-handoff", () => {
  const scope = { userId: "user-1", workspaceId: "ws-1" };
  const payload = { conversationId: "conv-7", ...scope };

  beforeEach(() => {
    localStorage.clear();
    emitToMock.mockClear();
    listenMock.mockClear();
  });

  it("continueInAssist só pede à janela main — não grava o id", async () => {
    saveActiveConversationId("conv-old", scope);

    await continueInAssist("conv-7", scope);

    expect(emitToMock).toHaveBeenCalledWith("main", ASSIST_CONTINUE_EVENT, payload);
    // KAN-71: quem grava é a ilha, ao aceitar.
    expect(loadActiveConversationId(scope)).toBe("conv-old");
  });

  it("acceptAssistContinue grava o id para a ilha e responde ao painel", async () => {
    await acceptAssistContinue(payload);

    expect(loadActiveConversationId(scope)).toBe("conv-7");
    expect(emitToMock).toHaveBeenCalledWith(
      "panel",
      ASSIST_CONTINUE_RESULT_EVENT,
      { conversationId: "conv-7", accepted: true },
    );
  });

  it("rejectAssistContinue responde ao painel sem tocar no id", async () => {
    saveActiveConversationId("conv-old", scope);

    await rejectAssistContinue(payload, "checklist");

    expect(loadActiveConversationId(scope)).toBe("conv-old");
    expect(emitToMock).toHaveBeenCalledWith(
      "panel",
      ASSIST_CONTINUE_RESULT_EVENT,
      { conversationId: "conv-7", accepted: false, reason: "checklist" },
    );
    expect(assistContinueRejectMessage("checklist")).toMatch(/procedimento aberto/);
  });

  it("listeners entregam o payload ao handler", async () => {
    const onContinue = vi.fn();
    const onResult = vi.fn();
    const captured: Array<(event: { payload: unknown }) => void> = [];
    listenMock.mockImplementation((..._args: unknown[]) => {
      captured.push(_args[1] as (event: { payload: unknown }) => void);
      return Promise.resolve(() => {});
    });

    await listenAssistContinue(onContinue);
    await listenAssistContinueResult(onResult);
    captured[0]?.({ payload });
    captured[1]?.({ payload: { conversationId: "conv-7", accepted: true } });

    expect(listenMock).toHaveBeenNthCalledWith(
      1,
      ASSIST_CONTINUE_EVENT,
      expect.any(Function),
    );
    expect(listenMock).toHaveBeenNthCalledWith(
      2,
      ASSIST_CONTINUE_RESULT_EVENT,
      expect.any(Function),
    );
    expect(onContinue).toHaveBeenCalledWith(payload);
    expect(onResult).toHaveBeenCalledWith({ conversationId: "conv-7", accepted: true });
  });
});
