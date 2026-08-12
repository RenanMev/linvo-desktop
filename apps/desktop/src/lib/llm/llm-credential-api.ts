import {
  llmCredentialStatusResponseSchema,
  type LlmCredentialStatusResponse,
  type UpdateLlmModelInput,
  type UpsertLlmCredentialInput,
} from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authorizedFetch } from "@/lib/auth/http";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      code?: string;
    };
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

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;

  try {
    response = await authorizedFetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  } catch (error) {
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new AuthNetworkError();
  }

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response), response.status);
  }

  return response.json();
}

function parseStatus(payload: unknown): LlmCredentialStatusResponse {
  return llmCredentialStatusResponseSchema.parse(payload);
}

export async function fetchUserLlmStatus(): Promise<LlmCredentialStatusResponse> {
  return parseStatus(await request("/api/me/llm"));
}

export async function upsertUserLlmCredential(
  input: UpsertLlmCredentialInput,
): Promise<LlmCredentialStatusResponse> {
  return parseStatus(
    await request("/api/me/llm", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
}

export async function updateUserLlmModel(
  input: UpdateLlmModelInput,
): Promise<LlmCredentialStatusResponse> {
  return parseStatus(
    await request("/api/me/llm/model", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteUserLlmCredential(): Promise<LlmCredentialStatusResponse> {
  return parseStatus(await request("/api/me/llm", { method: "DELETE" }));
}

export async function fetchWorkspaceLlmStatus(
  workspaceId: string,
): Promise<LlmCredentialStatusResponse> {
  return parseStatus(await request(`/api/workspaces/${workspaceId}/llm`));
}

export async function upsertWorkspaceLlmCredential(
  workspaceId: string,
  input: UpsertLlmCredentialInput,
): Promise<LlmCredentialStatusResponse> {
  return parseStatus(
    await request(`/api/workspaces/${workspaceId}/llm`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
}

export async function updateWorkspaceLlmModel(
  workspaceId: string,
  input: UpdateLlmModelInput,
): Promise<LlmCredentialStatusResponse> {
  return parseStatus(
    await request(`/api/workspaces/${workspaceId}/llm/model`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteWorkspaceLlmCredential(
  workspaceId: string,
): Promise<LlmCredentialStatusResponse> {
  return parseStatus(
    await request(`/api/workspaces/${workspaceId}/llm`, { method: "DELETE" }),
  );
}
