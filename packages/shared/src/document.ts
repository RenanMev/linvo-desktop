import { z } from "zod";

export const generatedDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  filename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().positive().optional(),
  createdByName: z.string().optional(),
  createdAt: z.string(),
});

export const documentListSchema = z.object({
  documents: z.array(generatedDocumentSchema),
});

export type GeneratedDocument = z.infer<typeof generatedDocumentSchema>;
export type DocumentList = z.infer<typeof documentListSchema>;
