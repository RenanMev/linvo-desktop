import {
  businessRuleSchema,
  createBusinessRuleInputSchema,
  createWorkspaceInputSchema,
  deleteWorkspaceInputSchema,
  transferWorkspaceOwnershipInputSchema,
  updateBusinessRuleInputSchema,
  updateWorkspaceInputSchema,
  workspaceSchema,
  workspaceStateSchema,
  type BusinessRule,
  type WorkspaceState,
  type CreateBusinessRuleInput,
  type CreateWorkspaceInput,
  type DeleteWorkspaceInput,
  type UpdateBusinessRuleInput,
  type UpdateWorkspaceInput,
  type Workspace,
} from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authorizedFetch } from "@/lib/auth/http";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function resolveWorkspaceImageUrl(
  imageUrl: string | null | undefined,
): string | null {
  if (!imageUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  return `${API_URL}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

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

export async function listWorkspaces(options?: {
  includeHidden?: boolean;
}): Promise<Workspace[]> {
  const query = options?.includeHidden ? "?includeHidden=true" : "";
  const data = (await request(`/api/workspaces${query}`)) as {
    workspaces: unknown[];
  };
  return data.workspaces.map((item) => workspaceSchema.parse(item));
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  createWorkspaceInputSchema.parse(input);
  const data = (await request("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { workspace: unknown };
  return workspaceSchema.parse(data.workspace);
}

export async function updateWorkspace(
  id: string,
  input: UpdateWorkspaceInput,
): Promise<Workspace> {
  updateWorkspaceInputSchema.parse(input);
  const data = (await request(`/api/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { workspace: unknown };
  return workspaceSchema.parse(data.workspace);
}

export async function activateWorkspace(id: string): Promise<Workspace> {
  const data = (await request(`/api/workspaces/${id}/activate`, {
    method: "POST",
  })) as { workspace: unknown };
  return workspaceSchema.parse(data.workspace);
}

/**
 * Versões dos recursos do workspace. É o único request do polling: barato o
 * bastante para rodar em intervalo curto, e o cliente só recarrega de fato o
 * que mudou de valor.
 */
export async function getWorkspaceState(id: string): Promise<WorkspaceState> {
  const data = await request(`/api/workspaces/${id}/state`);
  return workspaceStateSchema.parse(data);
}

export async function leaveWorkspace(id: string): Promise<void> {
  await request(`/api/workspaces/${id}/leave`, { method: "POST" });
}

export async function transferWorkspaceOwnership(
  id: string,
  userId: string,
): Promise<void> {
  const input = transferWorkspaceOwnershipInputSchema.parse({ userId });
  await request(`/api/workspaces/${id}/transfer-ownership`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteWorkspace(
  id: string,
  input: DeleteWorkspaceInput,
): Promise<void> {
  deleteWorkspaceInputSchema.parse(input);
  await request(`/api/workspaces/${id}`, {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}

export async function uploadWorkspaceImage(
  id: string,
  file: File,
): Promise<Workspace> {
  const form = new FormData();
  form.append("file", file);
  const data = (await request(
    `/api/workspaces/${id}/image`,
    {
      method: "POST",
      body: form,
    },
    { json: false },
  )) as { workspace: unknown };
  return workspaceSchema.parse(data.workspace);
}

export async function deleteWorkspaceImage(id: string): Promise<Workspace> {
  const data = (await request(`/api/workspaces/${id}/image`, {
    method: "DELETE",
  })) as { workspace: unknown };
  return workspaceSchema.parse(data.workspace);
}

export async function listBusinessRules(
  workspaceId: string,
): Promise<BusinessRule[]> {
  const data = (await request(
    `/api/workspaces/${workspaceId}/business-rules`,
  )) as { businessRules: unknown[] };
  return data.businessRules.map((item) => businessRuleSchema.parse(item));
}

export async function createBusinessRule(
  workspaceId: string,
  input: CreateBusinessRuleInput,
): Promise<BusinessRule> {
  createBusinessRuleInputSchema.parse(input);
  const data = (await request(
    `/api/workspaces/${workspaceId}/business-rules`,
    { method: "POST", body: JSON.stringify(input) },
  )) as { businessRule: unknown };
  return businessRuleSchema.parse(data.businessRule);
}

export async function updateBusinessRule(
  workspaceId: string,
  ruleId: string,
  input: UpdateBusinessRuleInput,
): Promise<BusinessRule> {
  updateBusinessRuleInputSchema.parse(input);
  const data = (await request(
    `/api/workspaces/${workspaceId}/business-rules/${ruleId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  )) as { businessRule: unknown };
  return businessRuleSchema.parse(data.businessRule);
}

export async function deleteBusinessRule(
  workspaceId: string,
  ruleId: string,
): Promise<void> {
  await request(`/api/workspaces/${workspaceId}/business-rules/${ruleId}`, {
    method: "DELETE",
  });
}
