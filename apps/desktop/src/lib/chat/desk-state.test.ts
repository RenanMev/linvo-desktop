import { describe, expect, it } from "vitest";
import { deskStateSchema, sendMessageInputSchema } from "@linvo/shared";

import { buildDeskState } from "@/lib/chat/desk-state";

describe("deskStateSchema", () => {
  it("accepts open procedure snapshot", () => {
    const parsed = deskStateSchema.parse({
      screenKey: "chat",
      openProcedure: {
        slug: "cancelamento",
        title: "Cancelamento",
        stepCount: 3,
        currentStepIndex: 0,
        completedStepIndexes: [],
      },
    });

    expect(parsed.openProcedure?.slug).toBe("cancelamento");
  });

  it("accepts null openProcedure", () => {
    const parsed = deskStateSchema.parse({
      screenKey: "chat",
      openProcedure: null,
    });
    expect(parsed.openProcedure).toBeNull();
  });
});

describe("sendMessageInputSchema deskState", () => {
  it("accepts deskState on send", () => {
    const parsed = sendMessageInputSchema.parse({
      content: "em que passo estou?",
      deskState: {
        screenKey: "chat",
        openProcedure: {
          slug: "cancelamento",
          title: "Cancelamento",
        },
      },
    });
    expect(parsed.deskState?.openProcedure?.slug).toBe("cancelamento");
  });
});

describe("buildDeskState", () => {
  it("builds snapshot from checklist by conversation", () => {
    const state = buildDeskState({
      conversationId: "c1",
      checklistByConversation: {
        c1: {
          procedure: {
            id: "p1",
            workspaceId: "ws-1",
            slug: "cancelamento",
            title: "Cancelamento",
            markdown: null,
            steps: ["a", "b", "c"],
            status: "PUBLISHED",
            retainVideo: false,
            videoPath: null,
            error: null,
            attemptCount: 1,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          progress: {
            currentStepIndex: 1,
            completedStepIndexes: [0],
          },
        },
      },
    });

    expect(state).toEqual({
      screenKey: "chat",
      openProcedure: {
        slug: "cancelamento",
        title: "Cancelamento",
        stepCount: 3,
        currentStepIndex: 1,
        completedStepIndexes: [0],
      },
    });
  });

  it("returns null openProcedure when checklist closed", () => {
    expect(
      buildDeskState({
        conversationId: "c1",
        checklistByConversation: {},
      }),
    ).toEqual({ screenKey: "chat", openProcedure: null });
  });
});
