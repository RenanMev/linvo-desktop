import { WORKSPACE_ID_HEADER } from "@linvo/shared";

const ACTIVE_WORKSPACE_KEY = "linvo.activeWorkspaceId";

export function getStoredWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export function setStoredWorkspaceId(workspaceId: string | null): void {
  try {
    // Trocar de workspace invalida o nome em cache: ele é do workspace
    // anterior. `getCachedWorkspaceName` já se recusaria a devolvê-lo (o id
    // não bate), mas apagar aqui evita deixar lixo indefinidamente.
    if (workspaceId !== getStoredWorkspaceId()) {
      setCachedWorkspaceName(null, null);
    }
    if (!workspaceId) {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch {
    return;
  }
}

export function clearStoredWorkspaceId(): void {
  setStoredWorkspaceId(null);
}

const WORKSPACE_NAME_KEY = "linvo.activeWorkspaceName";

/**
 * Nome do workspace ativo, guardado junto do id para poder ser lido de forma
 * SÍNCRONA na primeira renderização.
 *
 * Existe por causa da janela flutuante: o painel é revelado durante o morph de
 * abertura, e buscar o nome pela rede — por mais cedo que se comece — só
 * responde alguns quadros depois. Sem cache o campo nasce vazio e o texto
 * aparece no meio da animação. Com ele o nome já está lá no primeiro quadro, e
 * a rede vira só revalidação.
 *
 * Guardado com o id ao lado de propósito: se o workspace ativo mudou desde a
 * última gravação, o nome em cache é de outro workspace e não deve ser
 * mostrado. Melhor nascer vazio do que nascer errado.
 */
export function getCachedWorkspaceName(workspaceId: string | null): string | null {
  if (!workspaceId) {
    return null;
  }
  try {
    const raw = localStorage.getItem(WORKSPACE_NAME_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { id?: unknown; name?: unknown };
    if (parsed?.id !== workspaceId || typeof parsed.name !== "string") {
      return null;
    }
    return parsed.name;
  } catch {
    return null;
  }
}

export function setCachedWorkspaceName(
  workspaceId: string | null,
  name: string | null,
): void {
  try {
    if (!workspaceId || !name) {
      localStorage.removeItem(WORKSPACE_NAME_KEY);
      return;
    }
    localStorage.setItem(
      WORKSPACE_NAME_KEY,
      JSON.stringify({ id: workspaceId, name }),
    );
  } catch {
    return;
  }
}

export function workspaceHeaders(): Record<string, string> {
  const workspaceId = getStoredWorkspaceId();
  if (!workspaceId) {
    return {};
  }
  return { [WORKSPACE_ID_HEADER]: workspaceId };
}
