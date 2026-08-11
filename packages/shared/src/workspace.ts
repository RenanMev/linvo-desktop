import { z } from "zod";

export const WORKSPACE_ID_HEADER = "x-workspace-id";

export const workspaceRoleSchema = z.enum(["OWNER", "MEMBER"]);

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: workspaceRoleSchema,
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

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceInputSchema>;
export type BusinessRule = z.infer<typeof businessRuleSchema>;
export type CreateBusinessRuleInput = z.infer<typeof createBusinessRuleInputSchema>;
export type UpdateBusinessRuleInput = z.infer<typeof updateBusinessRuleInputSchema>;
