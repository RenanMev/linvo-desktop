import {
  activeInviteCodeResponseSchema,
  createInviteCodeResponseSchema,
  redeemInviteCodeInputSchema,
  redeemInviteCodeResponseSchema,
  type CreatedWorkspaceInviteCode,
  type RedeemInviteCodeResponse,
  type WorkspaceInviteCode,
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

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

export async function generateInviteCode(
  workspaceId: string,
): Promise<CreatedWorkspaceInviteCode> {
  const data = await request(`/api/workspaces/${workspaceId}/invite-codes`, {
    method: "POST",
  });
  return createInviteCodeResponseSchema.parse(data).inviteCode;
}

export async function getActiveInviteCode(
  workspaceId: string,
): Promise<WorkspaceInviteCode | null> {
  const data = await request(
    `/api/workspaces/${workspaceId}/invite-codes/active`,
  );
  return activeInviteCodeResponseSchema.parse(data).inviteCode;
}

export async function revokeInviteCode(workspaceId: string): Promise<void> {
  await request(`/api/workspaces/${workspaceId}/invite-codes/active`, {
    method: "DELETE",
  });
}

export async function redeemInviteCode(
  code: string,
): Promise<RedeemInviteCodeResponse> {
  const input = redeemInviteCodeInputSchema.parse({ code });
  const data = await request("/api/workspaces/invite-codes/redeem", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return redeemInviteCodeResponseSchema.parse(data);
}
