import { describe, expect, it } from "vitest";

import { mapApiMessageToChat, mapApiMessagesToChat } from "@/lib/chat/map-message";

describe("map-message", () => {
  it("maps API message to chat message", () => {
    const mapped = mapApiMessageToChat({
      id: "msg-1",
      role: "assistant",
      content: "Olá",
      status: "done",
      createdAt: "2026-01-01T12:00:00.000Z",
      replyTo: {
        id: "msg-0",
        role: "user",
        content: "Oi",
      },
    });

    expect(mapped).toEqual({
      id: "msg-1",
      role: "assistant",
      content: "Olá",
      status: "done",
      createdAt: new Date("2026-01-01T12:00:00.000Z").getTime(),
      replyTo: {
        id: "msg-0",
        role: "user",
        content: "Oi",
      },
    });
  });

  it("maps message list", () => {
    const mapped = mapApiMessagesToChat([
      {
        id: "msg-1",
        role: "user",
        content: "Oi",
        status: "done",
        createdAt: "2026-01-01T12:00:00.000Z",
      },
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.role).toBe("user");
  });
});
