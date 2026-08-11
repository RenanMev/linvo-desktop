import { z } from "zod";
import { workspaceRoleSchema, workspaceSchema } from "./workspace";

export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_TTL_MS = 5 * 60 * 1000;

export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const workspaceInviteCodeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  role: workspaceRoleSchema,
  expiresAt: z.string(),
  createdAt: z.string(),
  redeemedAt: z.string().nullable(),
  redeemedByName: z.string().nullable(),
});

export const createdWorkspaceInviteCodeSchema = workspaceInviteCodeSchema.extend({
  code: z.string(),
});

export const redeemInviteCodeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "informe o código de acesso")
    .transform(normalizeInviteCode)
    .refine((v) => v.length === INVITE_CODE_LENGTH, "código de acesso inválido"),
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
  joinedAt: z.string(),
});

export type WorkspaceInviteCode = z.infer<typeof workspaceInviteCodeSchema>;
export type CreatedWorkspaceInviteCode = z.infer<typeof createdWorkspaceInviteCodeSchema>;
export type RedeemInviteCodeInput = z.infer<typeof redeemInviteCodeInputSchema>;
export type RedeemInviteCodeResponse = z.infer<typeof redeemInviteCodeResponseSchema>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
