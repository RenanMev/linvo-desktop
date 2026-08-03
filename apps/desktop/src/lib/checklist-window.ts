import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import type { Procedure } from "@linvo/shared";

import type { ChecklistProgress } from "@/lib/chat/desk-state";

export const MAIN_LABEL = "main";
export const CHECKLIST_LABEL = "checklist";
export const CHECKLIST_PAYLOAD_EVENT = "checklist://payload";
export const CHECKLIST_DISMISS_EVENT = "checklist://dismiss";
export const CHECKLIST_PROGRESS_EVENT = "checklist://progress";
export const CHECKLIST_CLOSED_EVENT = "checklist://closed";

export type ChecklistWindowPayload = {
  conversationId: string;
  procedure: Procedure;
  progress: ChecklistProgress;
};

export type ChecklistProgressPayload = {
  conversationId: string;
  progress: ChecklistProgress;
};

export type ChecklistClosedPayload = {
  conversationId: string;
};

let activeChecklistConversationId: string | null = null;

export function rememberChecklistConversation(
  conversationId: string | null,
): void {
  activeChecklistConversationId = conversationId;
}

export function getActiveChecklistConversationId(): string | null {
  return activeChecklistConversationId;
}

async function ensureMainVisible(): Promise<void> {
  const main = await Window.getByLabel(MAIN_LABEL);
  if (!main) {
    return;
  }
  await main.show();
  await main.unminimize();
  await main.setFocus();
}

export async function openChecklist(
  payload: ChecklistWindowPayload,
): Promise<void> {
  rememberChecklistConversation(payload.conversationId);
  await ensureMainVisible();
  await emitTo(MAIN_LABEL, CHECKLIST_PAYLOAD_EVENT, payload);
}

export async function closeChecklist(options?: {
  emitClosed?: boolean;
}): Promise<void> {
  const conversationId = activeChecklistConversationId;
  activeChecklistConversationId = null;
  if (!conversationId) {
    return;
  }
  await emitTo(MAIN_LABEL, CHECKLIST_DISMISS_EVENT, {
    conversationId,
  } satisfies ChecklistClosedPayload);
  if (options?.emitClosed) {
    await emit(CHECKLIST_CLOSED_EVENT, { conversationId });
  }
}

export async function isChecklistOpen(): Promise<boolean> {
  return activeChecklistConversationId !== null;
}

export async function emitChecklistProgress(
  payload: ChecklistProgressPayload,
): Promise<void> {
  await emit(CHECKLIST_PROGRESS_EVENT, payload);
}

export async function emitChecklistClosed(
  payload: ChecklistClosedPayload,
): Promise<void> {
  await emit(CHECKLIST_CLOSED_EVENT, payload);
}

export async function listenChecklistPayload(
  handler: (payload: ChecklistWindowPayload) => void,
): Promise<() => void> {
  const unlisten = await listen<ChecklistWindowPayload>(
    CHECKLIST_PAYLOAD_EVENT,
    (event) => {
      rememberChecklistConversation(event.payload.conversationId);
      handler(event.payload);
    },
  );
  return unlisten;
}

export async function listenChecklistDismiss(
  handler: (payload: ChecklistClosedPayload) => void,
): Promise<() => void> {
  const unlisten = await listen<ChecklistClosedPayload>(
    CHECKLIST_DISMISS_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
  return unlisten;
}

export async function listenChecklistProgress(
  handler: (payload: ChecklistProgressPayload) => void,
): Promise<() => void> {
  const unlisten = await listen<ChecklistProgressPayload>(
    CHECKLIST_PROGRESS_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
  return unlisten;
}

export async function listenChecklistClosed(
  handler: (payload: ChecklistClosedPayload) => void,
): Promise<() => void> {
  const self = getCurrentWindow().label;
  const unlisten = await listen<ChecklistClosedPayload>(
    CHECKLIST_CLOSED_EVENT,
    (event) => {
      if (self === MAIN_LABEL) {
        return;
      }
      handler(event.payload);
    },
  );
  return unlisten;
}
