import {
  appearancePreferencesSchema,
  type AppearancePreferences,
  type UpdateAppearancePreferencesInput,
} from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authorizedFetch } from "@/lib/auth/http";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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

export async function fetchAppearance(): Promise<AppearancePreferences> {
  const data = (await request("/api/me/preferences")) as {
    preferences: unknown;
  };
  return appearancePreferencesSchema.parse(data.preferences);
}

export async function patchAppearance(
  input: UpdateAppearancePreferencesInput,
): Promise<AppearancePreferences> {
  const data = (await request("/api/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { preferences: unknown };
  return appearancePreferencesSchema.parse(data.preferences);
}
