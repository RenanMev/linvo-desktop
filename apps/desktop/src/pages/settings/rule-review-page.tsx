import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  AcceptRuleCandidateInput,
  RuleCandidate,
  RuleDiscoveryEvent,
  RuleDiscoverySessionDetail,
  RuleDiscoverySessionSummary,
} from "@linvo/shared";
import { ArrowLeft, ClipboardCheck, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";
import { AuthApiError } from "@/lib/auth/auth-api";
import { cn } from "@/lib/utils";
import * as ruleDiscoveryApi from "@/lib/workspace/rule-discovery-api";

const ACCEPTED_TYPES =
  "text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sessionStatusLabel(status: RuleDiscoverySessionDetail["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "PROCESSING":
      return "Processando";
    case "READY":
      return "Pronta";
    case "FAILED":
      return "Falhou";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function candidateCategoryLabel(
  category: RuleCandidate["category"],
): string {
  switch (category) {
    case "BUSINESS_RULE":
      return "Regra de negócio";
    case "RESPONSE_PATTERN":
      return "Padrão de resposta";
    case "FAQ_POLICY":
      return "FAQ / Política";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

function candidateStatusLabel(status: RuleCandidate["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "ACCEPTED":
      return "Aceito";
    case "REJECTED":
      return "Negado";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

type CandidateDraft = {
  title: string;
  content: string;
  promoteToRule: boolean;
  promoteToKnowledge: boolean;
};

function buildDraft(candidate: RuleCandidate): CandidateDraft {
  return {
    title: candidate.title,
    content: candidate.content,
    promoteToRule: candidate.promoteToRule === true,
    promoteToKnowledge: candidate.promoteToKnowledge === true,
  };
}

function eventCardTypes(type: RuleDiscoveryEvent["type"]): boolean {
  return (
    type === "candidate_found" ||
    type === "classified" ||
    type === "auto_promoted" ||
    type === "auto_skipped" ||
    type === "candidate_undone"
  );
}

export function RuleReviewPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspaces } = useWorkspace();

  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  const isOwner = workspace?.role === "OWNER";

  const [sessions, setSessions] = useState<RuleDiscoverySessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [sessionDetail, setSessionDetail] =
    useState<RuleDiscoverySessionDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>({});
  const [approvalMode, setApprovalMode] = useState<"QUESTION" | "ALLOW">(
    "QUESTION",
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async () => {
    if (!workspace || !isOwner) return;
    const list = await ruleDiscoveryApi.listSessions(workspace.id);
    setSessions(list);
  }, [workspace, isOwner]);

  const refreshSessionDetail = useCallback(async () => {
    if (!workspace || !selectedSessionId) return null;
    const detail = await ruleDiscoveryApi.getSession(
      workspace.id,
      selectedSessionId,
    );
    setSessionDetail(detail);
    setApprovalMode(detail.approvalMode);
    setConfidenceThreshold(detail.confidenceThreshold);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const candidate of detail.candidates) {
        if (candidate.status === "PENDING" && !next[candidate.id]) {
          next[candidate.id] = buildDraft(candidate);
        }
      }
      return next;
    });
    return detail;
  }, [workspace, selectedSessionId]);

  useEffect(() => {
    if (!workspace || !isOwner) {
      setSessions([]);
      return;
    }
    void refreshSessions().catch(() =>
      setError("Não foi possível carregar as sessões"),
    );
  }, [workspace, isOwner, refreshSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetail(null);
      return;
    }
    void refreshSessionDetail().catch(() =>
      setError("Não foi possível carregar a sessão"),
    );
  }, [selectedSessionId, refreshSessionDetail]);

  useEffect(() => {
    if (!sessionDetail) return;
    if (
      sessionDetail.status !== "PROCESSING" &&
      sessionDetail.status !== "PENDING"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSessionDetail().catch(() => undefined);
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionDetail?.id, sessionDetail?.status, refreshSessionDetail]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [sessionDetail?.events.length]);

  async function handleUpload(files: FileList | null) {
    if (!workspace || !files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const session = await ruleDiscoveryApi.createSession(
        workspace.id,
        Array.from(files),
        { approvalMode, confidenceThreshold },
      );
      await refreshSessions();
      setSelectedSessionId(session.id);
      setSessionDetail(session);
      setDrafts({});
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível enviar os arquivos");
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleControlsChange(next: {
    approvalMode?: "QUESTION" | "ALLOW";
    confidenceThreshold?: number;
  }) {
    const mode = next.approvalMode ?? approvalMode;
    const threshold = next.confidenceThreshold ?? confidenceThreshold;
    setApprovalMode(mode);
    setConfidenceThreshold(threshold);

    if (!workspace || !selectedSessionId) return;

    setBusy(true);
    setError(null);
    try {
      const session = await ruleDiscoveryApi.updateSession(
        workspace.id,
        selectedSessionId,
        { approvalMode: mode, confidenceThreshold: threshold },
      );
      setSessionDetail(session);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível atualizar o modo");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(candidate: RuleCandidate) {
    if (!workspace || !selectedSessionId) return;
    const draft = drafts[candidate.id] ?? buildDraft(candidate);
    if (!draft.promoteToRule && !draft.promoteToKnowledge) {
      setError("Selecione ao menos um destino (regra ou knowledge)");
      return;
    }

    const input: AcceptRuleCandidateInput = {
      promoteToRule: draft.promoteToRule,
      promoteToKnowledge: draft.promoteToKnowledge,
    };
    if (draft.title.trim() !== candidate.title) {
      input.title = draft.title.trim();
    }
    if (draft.content.trim() !== candidate.content) {
      input.content = draft.content.trim();
    }

    setBusy(true);
    setError(null);
    try {
      await ruleDiscoveryApi.acceptCandidate(
        workspace.id,
        selectedSessionId,
        candidate.id,
        input,
      );
      await refreshSessionDetail();
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível aceitar o candidato");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(candidate: RuleCandidate) {
    if (!workspace || !selectedSessionId) return;
    setBusy(true);
    setError(null);
    try {
      await ruleDiscoveryApi.rejectCandidate(
        workspace.id,
        selectedSessionId,
        candidate.id,
      );
      await refreshSessionDetail();
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível negar o candidato");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo(candidate: RuleCandidate) {
    if (!workspace || !selectedSessionId) return;
    setBusy(true);
    setError(null);
    try {
      await ruleDiscoveryApi.undoCandidate(
        workspace.id,
        selectedSessionId,
        candidate.id,
      );
      await refreshSessionDetail();
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível desfazer");
      }
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(
    candidateId: string,
    patch: Partial<CandidateDraft>,
  ): void {
    setDrafts((prev) => ({
      ...prev,
      [candidateId]: {
        ...(prev[candidateId] ?? {
          title: "",
          content: "",
          promoteToRule: false,
          promoteToKnowledge: false,
        }),
        ...patch,
      },
    }));
  }

  if (!workspace) {
    return (
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 text-muted-foreground"
            onClick={() => navigate("/settings/workspace")}
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </Button>
          <p className="text-xs text-muted-foreground">Workspace não encontrado</p>
        </div>
      </ScrollArea>
    );
  }

  if (!isOwner) {
    return (
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 text-muted-foreground"
            onClick={() =>
              navigate(`/settings/workspace/${workspace.id}`)
            }
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </Button>
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
            <p className="text-xs font-medium">Acesso restrito ao proprietário</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Apenas o owner pode revisar regras descobertas neste workspace.
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  const isProcessing =
    sessionDetail?.status === "PROCESSING" ||
    sessionDetail?.status === "PENDING";

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
        <div className="space-y-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 text-muted-foreground"
            onClick={() => navigate(`/settings/workspace/${workspace.id}`)}
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Rule Review</h1>
            <p className="text-xs text-muted-foreground">
              Envie documentos, acompanhe o raciocínio da IA e revise candidatos
              antes de promover para regras ou knowledge.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Modo da IA</h2>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Aprovação</span>
              <select
                className="flex h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
                value={approvalMode}
                aria-label="Modo de aprovação"
                disabled={busy}
                onChange={(event) =>
                  void handleControlsChange({
                    approvalMode: event.target.value as "QUESTION" | "ALLOW",
                  })
                }
              >
                <option value="QUESTION">Questionar</option>
                <option value="ALLOW">Permitir</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Limiar</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={confidenceThreshold}
                aria-label="Limiar de confidence"
                className="h-8 w-24 text-xs"
                disabled={busy}
                onChange={(event) =>
                  setConfidenceThreshold(Number(event.target.value))
                }
                onBlur={() =>
                  void handleControlsChange({ confidenceThreshold })
                }
              />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Upload</h2>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Enviar arquivos
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              TXT, PDF ou XLSX · até 4 arquivos · 5 MB cada
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Sessões recentes</h2>
          {sessions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Nenhuma sessão ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                    selectedSessionId === session.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40",
                  )}
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <span className="font-medium">
                    {new Date(session.createdAt).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-muted-foreground">
                    {sessionStatusLabel(session.status)} · {session.candidateCount}{" "}
                    candidatos
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {sessionDetail ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Detalhe da sessão</h2>
              {isProcessing ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Atualizando...
                </span>
              ) : null}
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-medium">
                Status: {sessionStatusLabel(sessionDetail.status)}
              </p>
              <div className="space-y-1">
                {sessionDetail.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between text-[11px] text-muted-foreground"
                  >
                    <span>{document.originalName}</span>
                    <span>{document.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Raciocínio</h3>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-background p-3">
                {sessionDetail.events.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Aguardando análise…
                  </p>
                ) : (
                  sessionDetail.events.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        eventCardTypes(event.type)
                          ? "border border-primary/20 bg-primary/5"
                          : "bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <p className="font-medium text-foreground">{event.message}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {event.type}
                      </p>
                    </div>
                  ))
                )}
                <div ref={conversationEndRef} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Checklist de candidatos</h3>
              {sessionDetail.candidates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhum candidato nesta sessão.
                </p>
              ) : (
                sessionDetail.candidates.map((candidate) => {
                  const draft = drafts[candidate.id] ?? buildDraft(candidate);
                  const isPending = candidate.status === "PENDING";
                  const isAccepted = candidate.status === "ACCEPTED";

                  return (
                    <article
                      key={candidate.id}
                      className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <ClipboardCheck className="size-4 text-muted-foreground" />
                        <span className="text-xs font-medium">
                          {candidateCategoryLabel(candidate.category)}
                        </span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {Math.round(candidate.confidence * 100)}%
                        </span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {candidateStatusLabel(candidate.status)}
                        </span>
                        {candidate.promotionSource ? (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {candidate.promotionSource === "AUTO"
                              ? "Auto"
                              : "Manual"}
                          </span>
                        ) : null}
                      </div>

                      {isPending ? (
                        <>
                          <Input
                            value={draft.title}
                            onChange={(event) =>
                              updateDraft(candidate.id, {
                                title: event.target.value,
                              })
                            }
                            className="h-8 text-xs"
                            aria-label="Título do candidato"
                          />
                          <textarea
                            value={draft.content}
                            onChange={(event) =>
                              updateDraft(candidate.id, {
                                content: event.target.value,
                              })
                            }
                            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                            aria-label="Conteúdo do candidato"
                          />
                          {candidate.sourceExcerpt ? (
                            <p className="text-[11px] text-muted-foreground">
                              Trecho: {candidate.sourceExcerpt}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-3 text-xs">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draft.promoteToRule}
                                onChange={(event) =>
                                  updateDraft(candidate.id, {
                                    promoteToRule: event.target.checked,
                                  })
                                }
                              />
                              Promover para regra
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draft.promoteToKnowledge}
                                onChange={(event) =>
                                  updateDraft(candidate.id, {
                                    promoteToKnowledge: event.target.checked,
                                  })
                                }
                              />
                              Promover para knowledge
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleAccept(candidate)}
                            >
                              Aceitar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void handleReject(candidate)}
                            >
                              Negar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium">{candidate.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {candidate.content}
                          </p>
                          {isAccepted ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void handleUndo(candidate)}
                            >
                              Desfazer
                            </Button>
                          ) : null}
                        </>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
