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

export function workspaceHeaders(): Record<string, string> {
  const workspaceId = getStoredWorkspaceId();
  if (!workspaceId) {
    return {};
  }
  return { [WORKSPACE_ID_HEADER]: workspaceId };
}
