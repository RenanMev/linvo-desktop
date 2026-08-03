import { describe, expect, it } from "vitest";

import {
  createProcedureInputSchema,
  listProceduresQuerySchema,
  procedureSchema,
  updateProcedureInputSchema,
} from "./procedure";

const baseProcedure = {
  id: "proc-1",
  workspaceId: "ws-1",
  status: "PENDING_REVIEW" as const,
  title: "Número cancelado",
  slug: null,
  markdown: "## Título / tema\n\nx",
  steps: null,
  retainVideo: false,
  videoPath: null,
  error: null,
  attemptCount: 1,
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
};

describe("procedureSchema", () => {
  it("accepts a valid procedure list item", () => {
    expect(procedureSchema.safeParse(baseProcedure).success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(
      procedureSchema.safeParse({ ...baseProcedure, status: "ARCHIVED" })
        .success,
    ).toBe(false);
  });
});

describe("createProcedureInputSchema", () => {
  it("defaults retainVideo to false", () => {
    const result = createProcedureInputSchema.parse({});
    expect(result.retainVideo).toBe(false);
  });

  it("parses retainVideo string true", () => {
    const result = createProcedureInputSchema.parse({ retainVideo: "true" });
    expect(result.retainVideo).toBe(true);
  });
});

describe("listProceduresQuerySchema", () => {
  it("normalizes single status to array", () => {
    const result = listProceduresQuerySchema.parse({ status: "PUBLISHED" });
    expect(result.status).toEqual(["PUBLISHED"]);
  });

  it("keeps status array", () => {
    const result = listProceduresQuerySchema.parse({
      status: ["PENDING_REVIEW", "FAILED", "PUBLISHED"],
    });
    expect(result.status).toEqual([
      "PENDING_REVIEW",
      "FAILED",
      "PUBLISHED",
    ]);
  });
});

describe("updateProcedureInputSchema", () => {
  it("accepts title and/or markdown", () => {
    expect(
      updateProcedureInputSchema.safeParse({ title: "Novo" }).success,
    ).toBe(true);
    expect(
      updateProcedureInputSchema.safeParse({ markdown: "## x" }).success,
    ).toBe(true);
  });

  it("rejects empty update", () => {
    expect(updateProcedureInputSchema.safeParse({}).success).toBe(false);
  });
});
