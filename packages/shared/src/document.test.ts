import { describe, expect, it } from "vitest";

import { documentListSchema, generatedDocumentSchema } from "./document";

describe("generatedDocumentSchema", () => {
  it("valida documento completo", () => {
    const parsed = generatedDocumentSchema.parse({
      id: "doc-1",
      title: "Relatório mensal",
      filename: "relatorio-mensal.pdf",
      sizeBytes: 4096,
      pageCount: 2,
      createdByName: "Ana",
      createdAt: "2026-07-30T12:00:00.000Z",
    });
    expect(parsed.title).toBe("Relatório mensal");
    expect(parsed.createdByName).toBe("Ana");
  });

  it("aceita documento sem pageCount e sem createdByName", () => {
    const parsed = generatedDocumentSchema.parse({
      id: "doc-1",
      title: "Relatório",
      filename: "relatorio.pdf",
      sizeBytes: 0,
      createdAt: "2026-07-30T12:00:00.000Z",
    });
    expect(parsed.pageCount).toBeUndefined();
    expect(parsed.createdByName).toBeUndefined();
  });

  it("rejeita sizeBytes negativo", () => {
    expect(() =>
      generatedDocumentSchema.parse({
        id: "doc-1",
        title: "Relatório",
        filename: "relatorio.pdf",
        sizeBytes: -1,
        createdAt: "2026-07-30T12:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("documentListSchema", () => {
  it("aceita lista vazia", () => {
    const parsed = documentListSchema.parse({ documents: [] });
    expect(parsed.documents).toEqual([]);
  });
});
