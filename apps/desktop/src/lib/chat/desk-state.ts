import type { DeskState, Procedure } from "@linvo/shared";

export type ChecklistProgress = {
  completedStepIndexes: number[];
  currentStepIndex?: number;
};

export type ChecklistByConversation = Record<
  string,
  {
    procedure: Procedure;
    progress: ChecklistProgress;
  }
>;

export function buildDeskState(input: {
  conversationId: string | null;
  checklistByConversation: ChecklistByConversation;
}): DeskState {
  const screenKey = "chat";
  if (!input.conversationId) {
    return { screenKey, openProcedure: null };
  }

  const entry = input.checklistByConversation[input.conversationId];
  if (!entry) {
    return { screenKey, openProcedure: null };
  }

  const slug = entry.procedure.slug?.trim();
  const title =
    entry.procedure.title?.trim() || entry.procedure.slug?.trim() || "Procedure";
  if (!slug) {
    return { screenKey, openProcedure: null };
  }

  const steps = entry.procedure.steps ?? [];
  return {
    screenKey,
    openProcedure: {
      slug,
      title,
      stepCount: steps.length,
      currentStepIndex: entry.progress.currentStepIndex,
      completedStepIndexes: entry.progress.completedStepIndexes,
    },
  };
}
