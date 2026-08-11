import { z } from "zod";

import { workspacePermissionSchema, workspaceRoleSchema } from "./permission";
import { workspaceSchema } from "./workspace";

export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const MAX_WORKSPACE_MEMBERS = 10;
export const INVITE_CODE_TTL_MS = 5 * 60 * 1000;

const inviteCodeCharSet = new Set(INVITE_CODE_ALPHABET.split(""));

export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((char) => inviteCodeCharSet.has(char))
    .join("")
    .slice(0, INVITE_CODE_LENGTH);
}

export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  if (normalized.length <= 4) {
    return normalized;
  }
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export const redeemInviteCodeInputSchema = z.object({
  code: z
    .string()
    .transform(normalizeInviteCode)
    .refine((value) => value.length === INVITE_CODE_LENGTH, {
      message: "código de acesso inválido",
    }),
});

export const workspaceInviteCodeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  redeemedAt: z.string().nullable(),
  redeemedByName: z.string().nullable(),
});

export const createdWorkspaceInviteCodeSchema = workspaceInviteCodeSchema.extend({
  code: z.string(),
});

export const createInviteCodeResponseSchema = z.object({
  inviteCode: createdWorkspaceInviteCodeSchema,
});

export const activeInviteCodeResponseSchema = z.object({
  inviteCode: workspaceInviteCodeSchema.nullable(),
});

export const redeemInviteCodeResponseSchema = z.object({
  workspace: workspaceSchema,
  alreadyMember: z.boolean(),
});

export const workspaceMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: workspaceRoleSchema,
  // grants/revokes são os overrides crus, para a tela de administração poder
  // renderizar o que foi explicitamente ligado ou desligado; permissions é o
  // resultado já resolvido, para não duplicar a fórmula no cliente.
  grants: z.array(workspacePermissionSchema),
  revokes: z.array(workspacePermissionSchema),
  permissions: z.array(workspacePermissionSchema),
  joinedAt: z.string(),
});

export const listWorkspaceMembersResponseSchema = z.object({
  members: z.array(workspaceMemberSchema),
});

export type RedeemInviteCodeInput = z.infer<typeof redeemInviteCodeInputSchema>;
export type WorkspaceInviteCode = z.infer<typeof workspaceInviteCodeSchema>;
export type CreatedWorkspaceInviteCode = z.infer<
  typeof createdWorkspaceInviteCodeSchema
>;
export type RedeemInviteCodeResponse = z.infer<
  typeof redeemInviteCodeResponseSchema
>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
