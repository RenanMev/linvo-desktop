import { documentListSchema, type GeneratedDocument } from "@linvo/shared";

import { AuthApiError, AuthNetworkError } from "@/lib/auth/auth-api";
import { authorizedFetch } from "@/lib/auth/http";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class DocumentApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DocumentApiError";
    this.status = status;
  }
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

async function requestDocuments(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;

  try {
    response = await authorizedFetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (error instanceof AuthApiError || error instanceof AuthNetworkError) {
      throw error;
    }
    throw new DocumentApiError("Erro inesperado", 500);
  }

  if (!response.ok) {
    throw new DocumentApiError(await parseErrorMessage(response), response.status);
  }

  return response;
}

export async function listDocuments(
  workspaceId: string,
): Promise<GeneratedDocument[]> {
  const response = await requestDocuments(
    `/api/workspaces/${workspaceId}/documents`,
  );
  const payload = documentListSchema.parse(await response.json());
  return payload.documents;
}

export async function fetchDocumentBytes(
  workspaceId: string,
  documentId: string,
): Promise<Uint8Array> {
  const response = await requestDocuments(
    `/api/workspaces/${workspaceId}/documents/${documentId}/download`,
  );
  return new Uint8Array(await response.arrayBuffer());
}

export async function deleteDocument(
  workspaceId: string,
  documentId: string,
): Promise<void> {
  await requestDocuments(`/api/workspaces/${workspaceId}/documents/${documentId}`, {
    method: "DELETE",
  });
}
