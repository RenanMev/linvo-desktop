import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApiError } from "@/lib/auth/auth-api";
import * as http from "@/lib/auth/http";
import * as procedureApi from "@/lib/procedure/procedure-api";

const procedureBase = {
  id: "proc-1",
  workspaceId: "ws-1",
  status: "PENDING_REVIEW" as const,
  title: "Número cancelado",
  slug: null as string | null,
  markdown: "## Título / tema\n\nx",
  steps: null as string[] | null,
  retainVideo: true,
  videoPath: "procedures/x.webm",
  error: null as string | null,
  attemptCount: 1,
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
};

describe("procedure-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("createProcedure posts multipart video with retainVideo", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          procedure: {
            ...procedureBase,
            status: "PROCESSING",
            title: null,
            markdown: null,
            attemptCount: 0,
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const blob = new Blob(["webm"], { type: "video/webm" });
    const procedure = await procedureApi.createProcedure("ws-1", blob, true);

    expect(procedure.status).toBe("PROCESSING");
    expect(procedure.retainVideo).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/workspaces\/ws-1\/procedures$/),
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("retainVideo")).toBe("true");
  });

  it("listProcedures appends status query and parses list", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(JSON.stringify({ procedures: [procedureBase] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const procedures = await procedureApi.listProcedures("ws-1", [
      "PENDING_REVIEW",
      "FAILED",
      "PUBLISHED",
    ]);

    expect(procedures).toHaveLength(1);
    expect(procedures[0]?.status).toBe("PENDING_REVIEW");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("status=PENDING_REVIEW"),
      expect.any(Object),
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("status=FAILED");
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("status=PUBLISHED");
  });

  it("getProcedure and getProcedureBySlug parse procedure", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(JSON.stringify({ procedure: procedureBase }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const byId = await procedureApi.getProcedure("ws-1", "proc-1");
    expect(byId.id).toBe("proc-1");

    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          procedure: { ...procedureBase, slug: "numero_cancelado" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const bySlug = await procedureApi.getProcedureBySlug(
      "ws-1",
      "numero_cancelado",
    );
    expect(bySlug.id).toBe("proc-1");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/procedures/by-slug/numero_cancelado"),
      expect.any(Object),
    );
  });

  it("updateProcedure patches title/markdown", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          procedure: { ...procedureBase, title: "Novo título" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const procedure = await procedureApi.updateProcedure("ws-1", "proc-1", {
      title: "Novo título",
    });
    expect(procedure.title).toBe("Novo título");
  });

  it("publishProcedure posts publish and returns published procedure", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          procedure: {
            ...procedureBase,
            status: "PUBLISHED",
            slug: "numero_cancelado",
            steps: ["Abrir o caso"],
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const procedure = await procedureApi.publishProcedure("ws-1", "proc-1");
    expect(procedure.status).toBe("PUBLISHED");
    expect(procedure.slug).toBe("numero_cancelado");
    expect(http.authorizedFetch).toHaveBeenCalledWith(
      expect.stringContaining("/procedures/proc-1/publish"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejectProcedure and deleteProcedure send void requests", async () => {
    const fetchSpy = vi
      .spyOn(http, "authorizedFetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await procedureApi.rejectProcedure("ws-1", "proc-1");
    await procedureApi.deleteProcedure("ws-1", "proc-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/procedures/proc-1/reject"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/procedures\/proc-1$/),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws AuthApiError when API returns error", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(
        JSON.stringify({ message: "slug já existe neste workspace; ajuste o título" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      procedureApi.publishProcedure("ws-1", "proc-1"),
    ).rejects.toMatchObject({
      name: "AuthApiError",
      status: 409,
      message: "slug já existe neste workspace; ajuste o título",
    } satisfies Partial<AuthApiError>);
  });
});
