import { emitTo, listen } from "@tauri-apps/api/event";

import {
  saveActiveConversationId,
  type ActiveConversationScope,
} from "@/lib/chat/active-conversation-store";
import { MAIN_LABEL } from "@/lib/checklist-window";

export const ASSIST_CONTINUE_EVENT = "assist://continue";
export const ASSIST_CONTINUE_RESULT_EVENT = "assist://continue-result";
const PANEL_LABEL = "panel";

export type AssistContinuePayload = ActiveConversationScope & {
  conversationId: string;
};

/** Payload + token de sequência, para a ilha distinguir pedidos repetidos. */
export type AssistContinueRequest = {
  conversationId: string;
  token: number;
};

export type AssistContinueRejectReason = "checklist";

export type AssistContinueResult =
  | { conversationId: string; accepted: true }
  | {
      conversationId: string;
      accepted: false;
      reason: AssistContinueRejectReason;
    };

/*
 * Painel → ilha: "continua esta conversa aí".
 *
 * O painel é histórico, só leitura; quem conversa é a ilha. O painel só
 * PEDE — quem grava o id na chave que `IslandChat` lê é a ilha, ao aceitar
 * (`acceptAssistContinue`). Gravar aqui antes do ack deixava rastro mesmo
 * quando a ilha recusava (modo checklist): na abertura seguinte ela pulava
 * de conversa sem ninguém ter pedido.
 */
export async function continueInAssist(
  conversationId: string,
  scope: ActiveConversationScope,
): Promise<void> {
  await emitTo(MAIN_LABEL, ASSIST_CONTINUE_EVENT, {
    conversationId,
    userId: scope.userId,
    workspaceId: scope.workspaceId,
  } satisfies AssistContinuePayload);
}

export async function listenAssistContinue(
  handler: (payload: AssistContinuePayload) => void,
): Promise<() => void> {
  const unlisten = await listen<AssistContinuePayload>(
    ASSIST_CONTINUE_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
  return unlisten;
}

/*
 * Ilha aceita: grava o id (cobre a ilha fechada, que monta já na conversa
 * certa) e avisa o painel. A troca com a ilha já aberta é o `continueRequest`.
 */
export async function acceptAssistContinue(
  payload: AssistContinuePayload,
): Promise<void> {
  saveActiveConversationId(payload.conversationId, {
    userId: payload.userId,
    workspaceId: payload.workspaceId,
  });
  await emitTo(PANEL_LABEL, ASSIST_CONTINUE_RESULT_EVENT, {
    conversationId: payload.conversationId,
    accepted: true,
  } satisfies AssistContinueResult);
}

export async function rejectAssistContinue(
  payload: AssistContinuePayload,
  reason: AssistContinueRejectReason,
): Promise<void> {
  await emitTo(PANEL_LABEL, ASSIST_CONTINUE_RESULT_EVENT, {
    conversationId: payload.conversationId,
    accepted: false,
    reason,
  } satisfies AssistContinueResult);
}

export async function listenAssistContinueResult(
  handler: (result: AssistContinueResult) => void,
): Promise<() => void> {
  const unlisten = await listen<AssistContinueResult>(
    ASSIST_CONTINUE_RESULT_EVENT,
    (event) => {
      handler(event.payload);
    },
  );
  return unlisten;
}

export function assistContinueRejectMessage(
  reason: AssistContinueRejectReason,
): string {
  switch (reason) {
    case "checklist":
      return "Termine o procedimento aberto no Assist antes de continuar outra conversa.";
  }
}
