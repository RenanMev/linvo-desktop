import type { LlmModelsResponse } from "@linvo/shared";
import { llmModelsResponseSchema } from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authorizedFetch } from "@/lib/auth/http";
import { ChatApiError } from "@/lib/chat/chat-api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const STORAGE_KEY = "linvo.chat.selectedModel";

export async function fetchLlmModels(): Promise<LlmModelsResponse> {
  let response: Response;
  try {
    response = await authorizedFetch(
      `${API_URL}/api/llm/models`,
      { method: "GET" },
      { onUnauthorized: "throw" },
    );
  } catch (error) {
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new ChatApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    throw new ChatApiError("Não foi possível carregar os modelos", response.status);
  }

  const payload = await response.json();
  return llmModelsResponseSchema.parse(payload);
}

export function loadSelectedModel(defaultModel: string): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim();
    return stored && stored.length > 0 ? stored : defaultModel;
  } catch {
    return defaultModel;
  }
}

export function saveSelectedModel(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, modelId);
  } catch {
    return;
  }
}
