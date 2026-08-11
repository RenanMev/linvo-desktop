import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

/**
 * Chaves de permissão do workspace. A granularidade separa o destrutivo do
 * resto (`rules:write` cria e edita, `rules:delete` apaga) porque restringir
 * quem apaga é o caso concreto — restringir quem edita quase nunca é.
 */
export const workspacePermissionSchema = z.enum([
  "rules:read",
  "rules:write",
  "rules:delete",
  "members:read",
  "members:manage",
  "invites:manage",
  "workspace:update",
  "workspace:delete",
  "discovery:manage",
  "procedures:read",
  "procedures:write",
  "procedures:delete",
  "documents:read",
  "documents:delete",
]);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type WorkspacePermission = z.infer<typeof workspacePermissionSchema>;

export const WORKSPACE_PERMISSIONS = workspacePermissionSchema.options;

/**
 * Deriva do papel `OWNER` e nunca de um grant: um ADMIN com `members:manage`
 * poderia se conceder o direito de apagar o workspace inteiro.
 */
export const OWNER_ONLY_PERMISSIONS: readonly WorkspacePermission[] = [
  "workspace:delete",
];

const MEMBER_PERMISSIONS: readonly WorkspacePermission[] = [
  "rules:read",
  "members:read",
  // procedures e documents nasceram só com checagem de pertencimento, então
  // MEMBER já criava os dois. Manter write preserva o comportamento; delete
  // sobe para ADMIN porque apagar o trabalho dos outros não tinha barreira.
  "procedures:read",
  "procedures:write",
  "documents:read",
];

const ADMIN_PERMISSIONS: readonly WorkspacePermission[] = [
  ...MEMBER_PERMISSIONS,
  "rules:write",
  "rules:delete",
  "members:manage",
  "invites:manage",
  "workspace:update",
  "discovery:manage",
  "procedures:delete",
  "documents:delete",
];

export const BASE_PERMISSIONS: Record<
  WorkspaceRole,
  readonly WorkspacePermission[]
> = {
  OWNER: WORKSPACE_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  MEMBER: MEMBER_PERMISSIONS,
};

function isWorkspacePermission(value: string): value is WorkspacePermission {
  return (WORKSPACE_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Permissões efetivas de um membro: `(base[papel] ∪ grants) \ revokes`.
 *
 * O OWNER ignora overrides por completo — sem isso um ADMIN com
 * `members:manage` conseguiria revogar os direitos do dono do workspace.
 * Chaves desconhecidas (resquício de uma permissão removida) são descartadas.
 * A ordem de saída segue `WORKSPACE_PERMISSIONS` para o payload ser estável.
 */
export function resolvePermissions(
  role: WorkspaceRole,
  grants: readonly string[] = [],
  revokes: readonly string[] = [],
): WorkspacePermission[] {
  if (role === "OWNER") {
    return [...WORKSPACE_PERMISSIONS];
  }

  const effective = new Set<WorkspacePermission>(BASE_PERMISSIONS[role]);

  for (const grant of grants) {
    if (
      isWorkspacePermission(grant) &&
      !OWNER_ONLY_PERMISSIONS.includes(grant)
    ) {
      effective.add(grant);
    }
  }

  for (const revoke of revokes) {
    if (isWorkspacePermission(revoke)) {
      effective.delete(revoke);
    }
  }

  return WORKSPACE_PERMISSIONS.filter((permission) =>
    effective.has(permission),
  );
}

export function hasPermission(
  permissions: readonly string[],
  required: WorkspacePermission,
): boolean {
  return permissions.includes(required);
}
