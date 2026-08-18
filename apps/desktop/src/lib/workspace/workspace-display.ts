import type { WorkspaceRole } from "@linvo/shared";

export function workspaceInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}

export function workspaceRoleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "OWNER":
      return "Proprietário";
    case "ADMIN":
      return "Administrador";
    case "MEMBER":
      return "Membro";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
