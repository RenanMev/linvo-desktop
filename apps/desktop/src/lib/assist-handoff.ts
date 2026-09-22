import { emitTo, listen } from "@tauri-apps/api/event";

import {
  saveActiveConversationId,
  type ActiveConversationScope,
} from "@/lib/chat/active-conversation-store";
import { MAIN_LABEL } from "@/lib/checklist-window";

export const ASSIST_CONTINUE_EVENT = "assist://continue";

export type AssistContinuePayload = {
  conversationId: string;
};

/** Payload + token de sequência, para a ilha distinguir pedidos repetidos. */
export type AssistContinueRequest = AssistContinuePayload & {
  token: number;
};

/*
 * Painel → ilha: "continua esta conversa aí".
 *
 * O painel é histórico, só leitura; quem conversa é a ilha. Gravar o id na
 * mesma chave que `IslandChat` lê cobre a ilha fechada (ela monta já na
 * conversa certa). O evento cobre a ilha aberta em outra conversa — sem ele
 * a troca só aconteceria na próxima montagem.
 */
export async function continueInAssist(
  conversationId: string,
  scope: ActiveConversationScope | null,
): Promise<void> {
  saveActiveConversationId(conversationId, scope);
  await emitTo(MAIN_LABEL, ASSIST_CONTINUE_EVENT, {
    conversationId,
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
