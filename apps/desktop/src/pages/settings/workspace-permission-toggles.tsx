import {
  BASE_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
  type WorkspaceMember,
  type WorkspacePermission,
} from "@linvo/shared";

import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<WorkspacePermission, string> = {
  "rules:read": "Ver regras",
  "rules:write": "Criar e editar regras",
  "rules:delete": "Apagar regras",
  "members:read": "Ver pessoas",
  "members:manage": "Gerenciar pessoas",
  "invites:manage": "Gerenciar convites",
  "workspace:update": "Editar nome e foto",
  "workspace:delete": "Apagar workspace",
  "discovery:manage": "Rule Review",
  "procedures:read": "Ver procedures",
  "procedures:write": "Criar e editar procedures",
  "procedures:delete": "Apagar procedures",
  "documents:read": "Ver documentos",
  "documents:delete": "Apagar documentos",
};

const GROUPS: { title: string; permissions: WorkspacePermission[] }[] = [
  {
    title: "Regras de negócio",
    permissions: ["rules:read", "rules:write", "rules:delete"],
  },
  {
    title: "Procedures e documentos",
    permissions: [
      "procedures:read",
      "procedures:write",
      "procedures:delete",
      "documents:read",
      "documents:delete",
    ],
  },
  {
    title: "Pessoas e workspace",
    permissions: [
      "members:read",
      "members:manage",
      "invites:manage",
      "workspace:update",
      "discovery:manage",
    ],
  },
];

/** Permissões que ninguém pode conceder — derivam do papel de dono. */
const EDITABLE_PERMISSIONS = WORKSPACE_PERMISSIONS.filter(
  (permission) =>
    !(OWNER_ONLY_PERMISSIONS as readonly string[]).includes(permission),
);

export type PermissionOverrides = {
  grants: WorkspacePermission[];
  revokes: WorkspacePermission[];
};

/**
 * Traduz um clique no toggle para overrides.
 *
 * O estado do toggle é a permissão efetiva, mas o que se persiste é o desvio
 * em relação à matriz base do papel — por isso ligar algo que a base já dá
 * significa "tirar dos revokes", e não "adicionar aos grants". Guardar o
 * desvio (e não o resultado) é o que faz uma promoção a ADMIN herdar as
 * permissões novas do papel em vez de congelar as antigas.
 */
export function togglePermission(
  member: Pick<WorkspaceMember, "role" | "grants" | "revokes">,
  permission: WorkspacePermission,
): PermissionOverrides {
  const base = BASE_PERMISSIONS[member.role] as readonly WorkspacePermission[];
  const inBase = base.includes(permission);
  const grants = new Set(member.grants);
  const revokes = new Set(member.revokes);
  const isEffective = inBase ? !revokes.has(permission) : grants.has(permission);

  if (isEffective) {
    grants.delete(permission);
    if (inBase) {
      revokes.add(permission);
    }
  } else {
    revokes.delete(permission);
    if (!inBase) {
      grants.add(permission);
    }
  }

  return {
    grants: WORKSPACE_PERMISSIONS.filter((p) => grants.has(p)),
    revokes: WORKSPACE_PERMISSIONS.filter((p) => revokes.has(p)),
  };
}

export function WorkspacePermissionToggles({
  member,
  disabled,
  onToggle,
}: {
  member: WorkspaceMember;
  disabled: boolean;
  onToggle: (permission: WorkspacePermission) => void;
}) {
  const base = BASE_PERMISSIONS[member.role] as readonly WorkspacePermission[];

  return (
    <div className="space-y-3">
      {GROUPS.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.title}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.permissions
              .filter((permission) => EDITABLE_PERMISSIONS.includes(permission))
              .map((permission) => {
                const active = member.permissions.includes(permission);
                const overridden =
                  member.grants.includes(permission) ||
                  member.revokes.includes(permission);

                return (
                  <button
                    key={permission}
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={PERMISSION_LABELS[permission]}
                    disabled={disabled}
                    onClick={() => onToggle(permission)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[11px] transition-colors",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-hairline bg-muted/30 text-muted-foreground",
                      // Um ponto marca o que foge da matriz base do papel, para
                      // o admin distinguir "veio do papel" de "eu mudei".
                      overridden && "ring-1 ring-primary/30",
                    )}
                    title={
                      base.includes(permission)
                        ? "Padrão do papel"
                        : "Concedido individualmente"
                    }
                  >
                    {PERMISSION_LABELS[permission]}
                    {overridden ? " ·" : ""}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
