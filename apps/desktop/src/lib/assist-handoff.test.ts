import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ASSIST_CONTINUE_EVENT,
  continueInAssist,
  listenAssistContinue,
} from "@/lib/assist-handoff";
import { loadActiveConversationId } from "@/lib/chat/active-conversation-store";
import { emitToMock, listenMock } from "@/test/mocks/tauri";

describe("assist-handoff", () => {
  const scope = { userId: "user-1", workspaceId: "ws-1" };

  beforeEach(() => {
    localStorage.clear();
    emitToMock.mockClear();
    listenMock.mockClear();
  });

  it("continueInAssist grava o id para a ilha e avisa a janela main", async () => {
    await continueInAssist("conv-7", scope);

    expect(loadActiveConversationId(scope)).toBe("conv-7");
    expect(emitToMock).toHaveBeenCalledWith("main", ASSIST_CONTINUE_EVENT, {
      conversationId: "conv-7",
    });
  });

  it("listenAssistContinue entrega o payload ao handler", async () => {
    const handler = vi.fn();
    let capturedHandler: ((event: { payload: unknown }) => void) | undefined;
    listenMock.mockImplementationOnce((..._args: unknown[]) => {
      capturedHandler = _args[1] as (event: { payload: unknown }) => void;
      return Promise.resolve(() => {});
    });

    await listenAssistContinue(handler);
    capturedHandler?.({ payload: { conversationId: "conv-9" } });

    expect(listenMock).toHaveBeenCalledWith(
      ASSIST_CONTINUE_EVENT,
      expect.any(Function),
    );
    expect(handler).toHaveBeenCalledWith({ conversationId: "conv-9" });
  });
});
