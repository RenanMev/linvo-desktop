import { chatTranscriptionResponseSchema } from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authDebug } from "@/lib/auth/auth-debug";
import { authorizedFetch } from "@/lib/auth/http";
import { ChatApiError } from "@/lib/chat/chat-api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const CHAT_AUTH_OPTIONS = { onUnauthorized: "throw" as const };

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message[0] ?? "Erro inesperado";
    }
    if (typeof body.message === "string") {
      return body.message;
    }
  } catch {
    return "Erro inesperado";
  }
  return "Erro inesperado";
}

/**
 * Push-to-talk: manda o áudio gravado na ilha e recebe o texto. Não cria
 * conversa nem anexo — o atendente ainda vai ler, editar e decidir enviar.
 */
export async function transcribeAudio(
  audio: Blob,
  filename = "push-to-talk.webm",
): Promise<string> {
  const path = "/api/conversations/transcriptions";
  authDebug("voice.transcribe", { path, bytes: audio.size });

  const form = new FormData();
  form.append("audio", audio, filename);

  let response: Response;
  try {
    response = await authorizedFetch(
      `${API_URL}${path}`,
      { method: "POST", body: form },
      CHAT_AUTH_OPTIONS,
    );
  } catch (error) {
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    throw new ChatApiError(await parseErrorMessage(response), response.status);
  }

  const data: unknown = await response.json();
  return chatTranscriptionResponseSchema.parse(data).text;
}
