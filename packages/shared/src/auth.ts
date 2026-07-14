import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .refine((value) => /[a-zA-Z]/.test(value), {
    message: "A senha deve conter ao menos uma letra",
  })
  .refine((value) => /\d/.test(value), {
    message: "A senha deve conter ao menos um número",
  })
  .refine((value) => /[^a-zA-Z0-9]/.test(value), {
    message: "A senha deve conter ao menos um caractere especial",
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("email inválido");

export const registerInputSchema = z.object({
  name: z.string().trim().min(1, "informe seu nome"),
  email: emailSchema,
  password: passwordSchema,
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "informe sua senha"),
});

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const userPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
});

export const authResultSchema = authTokensSchema.extend({
  user: userPublicSchema,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RefreshInput = z.infer<typeof refreshInputSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type UserPublic = z.infer<typeof userPublicSchema>;
export type AuthResult = z.infer<typeof authResultSchema>;
