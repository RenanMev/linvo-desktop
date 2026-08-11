import { describe, expect, it } from "vitest";

import {
  BASE_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
  hasPermission,
  resolvePermissions,
  workspacePermissionSchema,
} from "./permission";

describe("BASE_PERMISSIONS", () => {
  it("gives OWNER every permission", () => {
    expect(BASE_PERMISSIONS.OWNER).toEqual(WORKSPACE_PERMISSIONS);
  });

  it("keeps workspace:delete out of ADMIN and MEMBER", () => {
    expect(BASE_PERMISSIONS.ADMIN).not.toContain("workspace:delete");
    expect(BASE_PERMISSIONS.MEMBER).not.toContain("workspace:delete");
  });

  // Regressão da migração: MEMBER precisa continuar podendo exatamente o que
  // podia antes do permissionamento existir, ou a virada tira acesso de quem
  // já usava o produto.
  it("preserves the pre-permission MEMBER surface", () => {
    expect(BASE_PERMISSIONS.MEMBER).toEqual([
      "rules:read",
      "members:read",
      "procedures:read",
      "procedures:write",
      "documents:read",
    ]);
  });

  it("restricts the destructive procedure and document keys to ADMIN and up", () => {
    expect(BASE_PERMISSIONS.MEMBER).not.toContain("procedures:delete");
    expect(BASE_PERMISSIONS.MEMBER).not.toContain("documents:delete");
    expect(BASE_PERMISSIONS.ADMIN).toContain("procedures:delete");
    expect(BASE_PERMISSIONS.ADMIN).toContain("documents:delete");
  });

  it("makes ADMIN a superset of MEMBER", () => {
    for (const permission of BASE_PERMISSIONS.MEMBER) {
      expect(BASE_PERMISSIONS.ADMIN).toContain(permission);
    }
  });
});

describe("resolvePermissions", () => {
  it("returns the base set when there are no overrides", () => {
    expect(resolvePermissions("MEMBER")).toEqual(BASE_PERMISSIONS.MEMBER);
    expect(resolvePermissions("ADMIN")).toEqual(
      WORKSPACE_PERMISSIONS.filter((p) => BASE_PERMISSIONS.ADMIN.includes(p)),
    );
  });

  it("adds granted permissions on top of the base set", () => {
    const permissions = resolvePermissions("MEMBER", ["rules:write"]);
    expect(permissions).toContain("rules:write");
    expect(permissions).toContain("rules:read");
  });

  it("removes revoked permissions from the base set", () => {
    const permissions = resolvePermissions("MEMBER", [], ["rules:read"]);
    expect(permissions).not.toContain("rules:read");
  });

  it("lets revokes win over grants for the same key", () => {
    const permissions = resolvePermissions(
      "MEMBER",
      ["rules:write"],
      ["rules:write"],
    );
    expect(permissions).not.toContain("rules:write");
  });

  // Sem isso um ADMIN com members:manage poderia revogar os direitos do dono.
  it("ignores overrides entirely for OWNER", () => {
    const permissions = resolvePermissions(
      "OWNER",
      [],
      ["workspace:delete", "members:manage", "rules:read"],
    );
    expect(permissions).toEqual(WORKSPACE_PERMISSIONS);
  });

  it("never grants an owner-only permission", () => {
    for (const ownerOnly of OWNER_ONLY_PERMISSIONS) {
      expect(resolvePermissions("ADMIN", [ownerOnly])).not.toContain(ownerOnly);
      expect(resolvePermissions("MEMBER", [ownerOnly])).not.toContain(ownerOnly);
    }
  });

  it("drops unknown keys left over from removed permissions", () => {
    const permissions = resolvePermissions(
      "MEMBER",
      ["rules:archive", ""],
      ["rules:unknown"],
    );
    expect(permissions).toEqual(BASE_PERMISSIONS.MEMBER);
  });

  it("returns a stable order regardless of override order", () => {
    const a = resolvePermissions("MEMBER", ["rules:delete", "rules:write"]);
    const b = resolvePermissions("MEMBER", ["rules:write", "rules:delete"]);
    expect(a).toEqual(b);
    expect(a).toEqual(WORKSPACE_PERMISSIONS.filter((p) => a.includes(p)));
  });

  it("never returns duplicates when a grant repeats the base set", () => {
    const permissions = resolvePermissions("MEMBER", [
      "rules:read",
      "rules:read",
    ]);
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});

describe("hasPermission", () => {
  it("answers against a resolved permission list", () => {
    const permissions = resolvePermissions("MEMBER", ["rules:write"]);
    expect(hasPermission(permissions, "rules:write")).toBe(true);
    expect(hasPermission(permissions, "rules:delete")).toBe(false);
  });
});

describe("workspacePermissionSchema", () => {
  it("rejects a key outside the catalogue", () => {
    expect(workspacePermissionSchema.safeParse("rules:archive").success).toBe(
      false,
    );
  });

  it("accepts every catalogued key", () => {
    for (const permission of WORKSPACE_PERMISSIONS) {
      expect(workspacePermissionSchema.safeParse(permission).success).toBe(true);
    }
  });
});
