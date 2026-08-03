import { describe, expect, it } from "vitest";

import {
  extractSlashSlug,
  filterPublishedSlugs,
  parseSlashQuery,
} from "@/lib/procedure/slash-procedure";

describe("parseSlashQuery", () => {
  it("returns empty query when value is only slash", () => {
    expect(parseSlashQuery("/")).toBe("");
  });

  it("returns slug prefix while typing after slash", () => {
    expect(parseSlashQuery("/numero")).toBe("numero");
  });

  it("returns null for normal chat text", () => {
    expect(parseSlashQuery("olá")).toBeNull();
    expect(parseSlashQuery("/com espaços")).toBeNull();
  });
});

describe("filterPublishedSlugs", () => {
  const slugs = ["numero_cancelado", "troca_chip", "numero_portado"];

  it("lists all published slugs when query is empty", () => {
    expect(filterPublishedSlugs(slugs, "")).toEqual(slugs);
  });

  it("filters published slugs by prefix", () => {
    expect(filterPublishedSlugs(slugs, "numero")).toEqual([
      "numero_cancelado",
      "numero_portado",
    ]);
  });
});

describe("extractSlashSlug", () => {
  it("extracts exact slug command", () => {
    expect(extractSlashSlug("/numero_cancelado")).toBe("numero_cancelado");
  });

  it("returns null for incomplete slash-only input", () => {
    expect(extractSlashSlug("/")).toBeNull();
  });
});
