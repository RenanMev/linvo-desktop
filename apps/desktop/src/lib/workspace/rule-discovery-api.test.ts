import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApiError } from "@/lib/auth/auth-api";
import * as http from "@/lib/auth/http";
import * as ruleDiscoveryApi from "@/lib/workspace/rule-discovery-api";

const sessionDetail = {
  id: "session-1",
  workspaceId: "ws-1",
  status: "READY",
  error: null,
  documents: [],
  candidates: [],
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
};

describe("rule-discovery-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("createSession posts multipart files and parses session", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(JSON.stringify({ session: sessionDetail }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const file = new File(["texto"], "manual.txt", { type: "text/plain" });
    const session = await ruleDiscoveryApi.createSession("ws-1", [file]);

    expect(session.id).toBe("session-1");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/workspaces\/ws-1\/rule-discovery\/sessions$/),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("listSessions parses session summaries", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: [
            {
              id: "session-1",
              workspaceId: "ws-1",
              status: "READY",
              documentCount: 1,
              candidateCount: 2,
              createdAt: "2026-07-20T20:00:00.000Z",
              updatedAt: "2026-07-20T20:00:00.000Z",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const sessions = await ruleDiscoveryApi.listSessions("ws-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.candidateCount).toBe(2);
  });

  it("getSession parses session detail", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(JSON.stringify({ session: sessionDetail }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const session = await ruleDiscoveryApi.getSession("ws-1", "session-1");
    expect(session.status).toBe("READY");
  });

  it("acceptCandidate posts body and parses response", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidate: {
            id: "candidate-1",
            sessionId: "session-1",
            sourceDocumentId: "doc-1",
            category: "BUSINESS_RULE",
            title: "Regra",
            content: "Conteúdo",
            confidence: 0.9,
            sourceExcerpt: null,
            status: "ACCEPTED",
            promoteToRule: true,
            promoteToKnowledge: false,
            businessRuleId: "rule-1",
            knowledgeDocumentId: null,
            createdAt: "2026-07-20T20:00:00.000Z",
            updatedAt: "2026-07-20T20:00:00.000Z",
          },
          businessRule: {
            id: "rule-1",
            workspaceId: "ws-1",
            title: "Regra",
            content: "Conteúdo",
            priority: 0,
            active: true,
            createdAt: "2026-07-20T20:00:00.000Z",
            updatedAt: "2026-07-20T20:00:00.000Z",
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await ruleDiscoveryApi.acceptCandidate(
      "ws-1",
      "session-1",
      "candidate-1",
      { promoteToRule: true },
    );

    expect(result.candidate.status).toBe("ACCEPTED");
    expect(result.businessRule?.id).toBe("rule-1");
  });

  it("rejectCandidate parses rejected candidate", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidate: {
            id: "candidate-1",
            sessionId: "session-1",
            sourceDocumentId: "doc-1",
            category: "BUSINESS_RULE",
            title: "Regra",
            content: "Conteúdo",
            confidence: 0.9,
            sourceExcerpt: null,
            status: "REJECTED",
            promoteToRule: null,
            promoteToKnowledge: null,
            businessRuleId: null,
            knowledgeDocumentId: null,
            createdAt: "2026-07-20T20:00:00.000Z",
            updatedAt: "2026-07-20T20:00:00.000Z",
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const candidate = await ruleDiscoveryApi.rejectCandidate(
      "ws-1",
      "session-1",
      "candidate-1",
    );

    expect(candidate.status).toBe("REJECTED");
  });

  it("throws AuthApiError when API returns error", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "apenas o owner pode alterar este workspace" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(ruleDiscoveryApi.listSessions("ws-1")).rejects.toMatchObject({
      name: "AuthApiError",
      status: 403,
      message: "apenas o owner pode alterar este workspace",
    } satisfies Partial<AuthApiError>);
  });
});
