import { z } from "zod";

import { workspacePermissionSchema, workspaceRoleSchema } from "./permission";

export const WORKSPACE_ID_HEADER = "x-workspace-id";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: workspaceRoleSchema,
  // Permissões efetivas do usuário corrente neste workspace, já com os
  // overrides aplicados. Chega junto da listagem para o cliente decidir o que
  // renderizar sem um request extra por troca de workspace.
  permissions: z.array(workspacePermissionSchema),
  imageUrl: z.string().nullable(),
  hidden: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});


export const createWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1, "informe o nome do workspace"),
});

export const updateWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1, "informe o nome do workspace"),
});

export const deleteWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1, "informe o nome do workspace"),
});

export const businessRuleSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  content: z.string(),
  priority: z.number().int(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createBusinessRuleInputSchema = z.object({
  title: z.string().trim().min(1, "informe o título"),
  content: z.string().trim().min(1, "informe o conteúdo"),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const updateBusinessRuleInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
});

/**
 * Papéis atribuíveis por um administrador. `OWNER` fica de fora de propósito:
 * a posse só muda por transferência explícita, que troca os dois lados numa
 * transação e mantém a garantia de um único dono por workspace.
 */
export const assignableWorkspaceRoleSchema = z.enum(["ADMIN", "MEMBER"]);

export const updateWorkspaceMemberInputSchema = z
  .object({
    role: assignableWorkspaceRoleSchema.optional(),
    grants: z.array(workspacePermissionSchema).optional(),
    revokes: z.array(workspacePermissionSchema).optional(),
  })
  .refine(
    (value) =>
      value.role !== undefined ||
      value.grants !== undefined ||
      value.revokes !== undefined,
    { message: "informe role, grants e/ou revokes" },
  );

export const transferWorkspaceOwnershipInputSchema = z.object({
  userId: z.string().trim().min(1, "informe o novo dono"),
});

/**
 * Versão de cada recurso do workspace, no formato `contagem:maiorUpdatedAtMs`.
 * O cliente compara com o último valor visto e só refaz o fetch do que mudou —
 * a contagem pega criação e remoção, o timestamp pega edição.
 */
export const workspaceStateSchema = z.object({
  workspace: z.string(),
  members: z.string(),
  rules: z.string(),
  discovery: z.string(),
  procedures: z.string(),
  documents: z.string(),
});

export type AssignableWorkspaceRole = z.infer<
  typeof assignableWorkspaceRoleSchema
>;
export type UpdateWorkspaceMemberInput = z.infer<
  typeof updateWorkspaceMemberInputSchema
>;
export type TransferWorkspaceOwnershipInput = z.infer<
  typeof transferWorkspaceOwnershipInputSchema
>;
export type WorkspaceState = z.infer<typeof workspaceStateSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceInputSchema>;
export type BusinessRule = z.infer<typeof businessRuleSchema>;
export type CreateBusinessRuleInput = z.infer<typeof createBusinessRuleInputSchema>;
export type UpdateBusinessRuleInput = z.infer<typeof updateBusinessRuleInputSchema>;
