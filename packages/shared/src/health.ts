import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string(),
  checks: z.object({
    database: z.enum(["ok", "error"]),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
