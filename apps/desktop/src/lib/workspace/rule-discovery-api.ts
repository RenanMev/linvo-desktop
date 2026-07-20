import {
  acceptRuleCandidateInputSchema,
  acceptRuleCandidateResponseSchema,
  createRuleDiscoverySessionResponseSchema,
  getRuleDiscoverySessionResponseSchema,
  listRuleDiscoverySessionsResponseSchema,
  rejectRuleCandidateResponseSchema,
  type AcceptRuleCandidateInput,
  type AcceptRuleCandidateResponse,
  type RuleDiscoverySessionDetail,
  type RuleDiscoverySessionSummary,
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

export async function createSession(
  workspaceId: string,
  files: File[],
): Promise<RuleDiscoverySessionDetail> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }

  const data = (await request(
    `/api/workspaces/${workspaceId}/rule-discovery/sessions`,
    {
      method: "POST",
      body: form,
    },
    { json: false },
  )) as { session: unknown };

  return createRuleDiscoverySessionResponseSchema.parse(data).session;
}

export async function listSessions(
  workspaceId: string,
): Promise<RuleDiscoverySessionSummary[]> {
  const data = (await request(
    `/api/workspaces/${workspaceId}/rule-discovery/sessions`,
  )) as { sessions: unknown[] };

  return listRuleDiscoverySessionsResponseSchema.parse(data).sessions;
}

export async function getSession(
  workspaceId: string,
  sessionId: string,
): Promise<RuleDiscoverySessionDetail> {
  const data = (await request(
    `/api/workspaces/${workspaceId}/rule-discovery/sessions/${sessionId}`,
  )) as { session: unknown };

  return getRuleDiscoverySessionResponseSchema.parse(data).session;
}

export async function acceptCandidate(
  workspaceId: string,
  sessionId: string,
  candidateId: string,
  input: AcceptRuleCandidateInput,
): Promise<AcceptRuleCandidateResponse> {
  acceptRuleCandidateInputSchema.parse(input);

  const data = await request(
    `/api/workspaces/${workspaceId}/rule-discovery/sessions/${sessionId}/candidates/${candidateId}/accept`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return acceptRuleCandidateResponseSchema.parse(data);
}

export async function rejectCandidate(
  workspaceId: string,
  sessionId: string,
  candidateId: string,
): Promise<AcceptRuleCandidateResponse["candidate"]> {
  const data = await request(
    `/api/workspaces/${workspaceId}/rule-discovery/sessions/${sessionId}/candidates/${candidateId}/reject`,
    {
      method: "POST",
    },
  );

  return rejectRuleCandidateResponseSchema.parse(data).candidate;
}
