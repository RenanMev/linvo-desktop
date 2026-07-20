import { beforeEach, describe, expect, it, vi } from "vitest";

import * as http from "@/lib/auth/http";
import { ChatApiError, deleteConversation } from "@/lib/chat/chat-api";

describe("deleteConversation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /api/conversations/:id and resolves on 204", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await expect(deleteConversation("conv-1")).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/conversations\/conv-1$/),
      expect.objectContaining({ method: "DELETE" }),
      expect.anything(),
    );
  });

  it("throws ChatApiError with status when API returns error", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "conversa não encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(deleteConversation("missing")).rejects.toMatchObject({
      name: "ChatApiError",
      status: 404,
      message: "conversa não encontrada",
    } satisfies Partial<ChatApiError>);
  });
});
