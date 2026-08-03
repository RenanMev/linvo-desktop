import { describe, expect, it } from "vitest";

import {
  decideProcedureOpenRequest,
  isCreateProcedureToolRequest,
  isOpenProcedureToolRequest,
  parseCreateProcedureArgs,
  resolveProcedureSlugFromToolRequest,
} from "@/lib/chat/procedure-tool-request";

describe("procedure-tool-request", () => {
  it("detecta open_procedure com slug e tools dinâmicas por nome", () => {
    expect(
      isOpenProcedureToolRequest({
        name: "open_procedure",
        args: { slug: "x" },
      }),
    ).toBe(true);
    expect(
      isOpenProcedureToolRequest({
        name: "procedimento_para_cancelamento_de_planos_no_crm",
      }),
    ).toBe(true);
    expect(isOpenProcedureToolRequest({ name: "create_procedure" })).toBe(
      false,
    );
    expect(isOpenProcedureToolRequest({ name: "read_clipboard" })).toBe(
      false,
    );
    expect(isOpenProcedureToolRequest({ name: "open_procedure", args: {} })).toBe(
      false,
    );
  });

  it("resolve slug de open_procedure e de tool dinâmica", () => {
    expect(
      resolveProcedureSlugFromToolRequest({
        name: "open_procedure",
        args: { slug: " procedimento_x " },
      }),
    ).toBe("procedimento_x");
    expect(
      resolveProcedureSlugFromToolRequest({
        name: "procedimento_para_cancelamento_de_planos_no_crm",
      }),
    ).toBe("procedimento_para_cancelamento_de_planos_no_crm");
    expect(
      resolveProcedureSlugFromToolRequest({ name: "create_procedure" }),
    ).toBeNull();
  });

  it("decide open vs already_open vs not_procedure", () => {
    expect(
      decideProcedureOpenRequest(
        { name: "read_clipboard" },
        new Set(),
      ),
    ).toEqual({ kind: "not_procedure" });

    expect(
      decideProcedureOpenRequest(
        {
          name: "procedimento_para_cancelamento_de_planos_no_crm",
        },
        new Set(),
      ),
    ).toEqual({
      kind: "open",
      slug: "procedimento_para_cancelamento_de_planos_no_crm",
    });

    expect(
      decideProcedureOpenRequest(
        {
          name: "procedimento_para_cancelamento_de_planos_no_crm",
        },
        new Set(["procedimento_para_cancelamento_de_planos_no_crm"]),
      ),
    ).toEqual({
      kind: "already_open",
      slug: "procedimento_para_cancelamento_de_planos_no_crm",
    });
  });

  it("parseia args de create_procedure", () => {
    expect(
      parseCreateProcedureArgs({
        title: "Cancelamento",
        steps: ["Abrir CRM", "  ", "Cancelar"],
      }),
    ).toEqual({
      title: "Cancelamento",
      markdown: undefined,
      steps: ["Abrir CRM", "Cancelar"],
    });
    expect(parseCreateProcedureArgs({ title: "X" })).toBeNull();
    expect(isCreateProcedureToolRequest({ name: "create_procedure" })).toBe(
      true,
    );
  });
});
