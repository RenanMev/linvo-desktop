import {
  createProcedureFromTextInputSchema,
  createProcedureResponseSchema,
  getProcedureResponseSchema,
  listProceduresResponseSchema,
  publishProcedureResponseSchema,
  updateProcedureInputSchema,
  updateProcedureResponseSchema,
  type CreateProcedureFromTextInput,
  type Procedure,
  type ProcedureStatus,
  type UpdateProcedureInput,
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

async function request(
  path: string,
  init?: RequestInit,
  options?: { json?: boolean },
): Promise<unknown> {
  const useJson = options?.json !== false;
  let response: Response;

  try {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (useJson && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    response = await authorizedFetch(`${API_URL}${path}`, {
      ...init,
      headers,
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

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

export async function createProcedure(
  workspaceId: string,
  video: File | Blob,
  retainVideo: boolean,
  filename = "capture.webm",
): Promise<Procedure> {
  const form = new FormData();
  form.append("video", video, filename);
  form.append("retainVideo", retainVideo ? "true" : "false");

  const data = (await request(
    `/api/workspaces/${workspaceId}/procedures`,
    {
      method: "POST",
      body: form,
    },
    { json: false },
  )) as { procedure: unknown };

  return createProcedureResponseSchema.parse(data).procedure;
}

export async function createProcedureFromText(
  workspaceId: string,
  input: CreateProcedureFromTextInput,
): Promise<Procedure> {
  const parsed = createProcedureFromTextInputSchema.parse(input);
  const data = (await request(
    `/api/workspaces/${workspaceId}/procedures/from-text`,
    {
      method: "POST",
      body: JSON.stringify(parsed),
    },
  )) as { procedure: unknown };

  return createProcedureResponseSchema.parse(data).procedure;
}

export async function listProcedures(
  workspaceId: string,
  statuses?: ProcedureStatus[],
): Promise<Procedure[]> {
  const params = new URLSearchParams();
  for (const status of statuses ?? []) {
    params.append("status", status);
  }
  const query = params.toString();
  const data = (await request(
    `/api/workspaces/${workspaceId}/procedures${query ? `?${query}` : ""}`,
  )) as { procedures: unknown[] };

  return listProceduresResponseSchema.parse(data).procedures;
}

export async function getProcedure(
  workspaceId: string,
  procedureId: string,
): Promise<Procedure> {
  const data = (await request(
    `/api/workspaces/${workspaceId}/procedures/${procedureId}`,
  )) as { procedure: unknown };

  return getProcedureResponseSchema.parse(data).procedure;
}

export async function getProcedureBySlug(
  workspaceId: string,
  slug: string,
): Promise<Procedure> {
  const data = (await request(
    `/api/workspaces/${workspaceId}/procedures/by-slug/${encodeURIComponent(slug)}`,
  )) as { procedure: unknown };

  return getProcedureResponseSchema.parse(data).procedure;
}

export async function updateProcedure(
  workspaceId: string,
  procedureId: string,
  input: UpdateProcedureInput,
): Promise<Procedure> {
  updateProcedureInputSchema.parse(input);

  const data = (await request(
    `/api/workspaces/${workspaceId}/procedures/${procedureId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  )) as { procedure: unknown };

  return updateProcedureResponseSchema.parse(data).procedure;
}

export async function publishProcedure(
  workspaceId: string,
  procedureId: string,
): Promise<Procedure> {
  const data = (await request(
    `/api/workspaces/${workspaceId}/procedures/${procedureId}/publish`,
    {
      method: "POST",
    },
  )) as { procedure: unknown };

  return publishProcedureResponseSchema.parse(data).procedure;
}

export async function rejectProcedure(
  workspaceId: string,
  procedureId: string,
): Promise<void> {
  await request(
    `/api/workspaces/${workspaceId}/procedures/${procedureId}/reject`,
    {
      method: "POST",
    },
  );
}

export async function deleteProcedure(
  workspaceId: string,
  procedureId: string,
): Promise<void> {
  await request(`/api/workspaces/${workspaceId}/procedures/${procedureId}`, {
    method: "DELETE",
  });
}
