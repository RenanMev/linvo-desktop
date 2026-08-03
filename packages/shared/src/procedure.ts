import { z } from "zod";

export const procedureStatusSchema = z.enum([
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "FAILED",
]);

export const createProcedureInputSchema = z.object({
  retainVideo: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true")
    .default(false),
});

export const createProcedureFromTextInputSchema = z
  .object({
    title: z.string().trim().min(1),
    markdown: z.string().trim().min(1).optional(),
    steps: z.array(z.string().trim().min(1)).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.markdown && (!value.steps || value.steps.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "informe markdown e/ou steps",
        path: ["markdown"],
      });
    }
  });

export const listProceduresQuerySchema = z.object({
  status: z
    .union([procedureStatusSchema, z.array(procedureStatusSchema)])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return Array.isArray(value) ? value : [value];
    }),
});

export const updateProcedureInputSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    markdown: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.markdown !== undefined,
    {
      message: "informe title e/ou markdown",
    },
  );

export const procedureSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  status: procedureStatusSchema,
  title: z.string().nullable(),
  slug: z.string().nullable(),
  markdown: z.string().nullable(),
  steps: z.array(z.string()).nullable(),
  retainVideo: z.boolean(),
  videoPath: z.string().nullable(),
  error: z.string().nullable(),
  attemptCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createProcedureResponseSchema = z.object({
  procedure: procedureSchema,
});

export const listProceduresResponseSchema = z.object({
  procedures: z.array(procedureSchema),
});

export const getProcedureResponseSchema = z.object({
  procedure: procedureSchema,
});

export const updateProcedureResponseSchema = z.object({
  procedure: procedureSchema,
});

export const publishProcedureResponseSchema = z.object({
  procedure: procedureSchema,
});

export type ProcedureStatus = z.infer<typeof procedureStatusSchema>;
export type CreateProcedureInput = z.infer<typeof createProcedureInputSchema>;
export type CreateProcedureFromTextInput = z.infer<
  typeof createProcedureFromTextInputSchema
>;
export type ListProceduresQuery = z.infer<typeof listProceduresQuerySchema>;
export type UpdateProcedureInput = z.infer<typeof updateProcedureInputSchema>;
export type Procedure = z.infer<typeof procedureSchema>;
