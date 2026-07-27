import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  AcceptRuleCandidateInput,
  RuleCandidate,
  RuleDiscoverySessionDetail,
  RuleDiscoverySessionSummary,
} from "@linvo/shared";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Loader2,
  Scale,
  Sparkles,
  Square,
  Undo2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RuleReviewReasoningPanel } from "@/pages/settings/rule-review-reasoning-panel";
import { useWorkspace } from "@/context/workspace-context";
import { AuthApiError } from "@/lib/auth/auth-api";
import { cn } from "@/lib/utils";
import * as ruleDiscoveryApi from "@/lib/workspace/rule-discovery-api";

const ACCEPTED_TYPES =
  "text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sessionStatusLabel(
  status: RuleDiscoverySessionDetail["status"],
): string {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "PROCESSING":
      return "Processando";
    case "READY":
      return "Pronta";
    case "FAILED":
      return "Falhou";
    case "CANCELLED":
      return "Encerrada";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function candidateCategoryLabel(category: RuleCandidate["category"]): string {
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

function approvalModeLabel(mode: "QUESTION" | "ALLOW"): string {
  switch (mode) {
    case "QUESTION":
      return "Questionar";
    case "ALLOW":
      return "Permitir";
    default: {
      const _exhaustive: never = mode;
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

function SectionHeading({
  title,
  description,
  count,
  action,
}: {
  title: string;
  description?: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {typeof count === "number" ? (
          <span className="grid size-6 place-items-center rounded-md bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}

function PromoteCheck({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex select-none items-center gap-2 text-xs",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer text-foreground",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "grid size-4 place-items-center rounded border transition-colors",
          checked
            ? "border-accent-active bg-accent-active text-accent-active-foreground"
            : "border-hairline-strong bg-transparent text-transparent",
          disabled && "pointer-events-none",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>
      {label}
    </label>
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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleUpload(files: FileList | File[] | null) {
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

  async function handleCancelSession(sessionId: string) {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      const session = await ruleDiscoveryApi.cancelSession(
        workspace.id,
        sessionId,
      );
      await refreshSessions();
      if (selectedSessionId === sessionId) {
        setSessionDetail(session);
      }
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível encerrar a análise");
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
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-muted/20 px-4 py-10 text-center">
            <ClipboardCheck className="size-5 text-muted-foreground/70" />
            <p className="text-xs font-medium">Workspace não encontrado</p>
          </div>
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
            onClick={() => navigate(`/settings/workspace/${workspace.id}`)}
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </Button>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-muted/20 px-4 py-10 text-center">
            <ClipboardCheck className="size-5 text-muted-foreground/70" />
            <p className="text-xs font-medium">Acesso restrito ao proprietário</p>
            <p className="max-w-xs text-[11px] text-muted-foreground">
              Apenas o owner pode revisar regras descobertas neste workspace.
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  const pendingCount =
    sessionDetail?.candidates.filter((c) => c.status === "PENDING").length ?? 0;

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-9 px-6 py-8">
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

          <div className="space-y-2">
            <h1 className="text-lg font-semibold tracking-tight">Rule Review</h1>
            <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
              Envie documentos, acompanhe o raciocínio da IA e revise candidatos
              antes de promover para regras ou knowledge.
            </p>
          </div>
        </div>

        {error ? (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="text-xs text-destructive">{error}</p>
            <button
              type="button"
              className="text-destructive/70 hover:text-destructive"
              aria-label="Fechar erro"
              onClick={() => setError(null)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        <section className="space-y-3">
          <SectionHeading
            title="Modo da IA"
            description="Vale para o próximo upload e para a sessão aberta."
          />
          <div className="rounded-xl border border-hairline bg-muted/40 p-4">
            <div className="flex flex-col gap-6 sm:flex-row sm:gap-7">
              <div className="min-w-0 flex-1">
                <label className="mb-2 block font-technical text-[10px] uppercase tracking-wide text-muted-foreground">
                  Aprovação
                </label>
                <div
                  role="radiogroup"
                  aria-label="Modo de aprovação"
                  className="flex gap-1.5"
                >
                  {(["QUESTION", "ALLOW"] as const).map((mode) => {
                    const active = approvalMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={busy}
                        onClick={() =>
                          void handleControlsChange({ approvalMode: mode })
                        }
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                          active
                            ? "nav-pill-active"
                            : "border border-hairline text-foreground/70 hover:bg-surface-hover",
                        )}
                      >
                        {approvalModeLabel(mode)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <label className="mb-2 block font-technical text-[10px] uppercase tracking-wide text-muted-foreground">
                  Limiar de confiança
                </label>
                <div className="space-y-2">
                  <span className="font-technical text-lg tabular-nums">
                    {confidenceThreshold.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={confidenceThreshold}
                    aria-label="Limiar de confiança"
                    disabled={busy}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-raise-2 accent-accent-active disabled:opacity-50"
                    onChange={(event) =>
                      setConfidenceThreshold(Number(event.target.value))
                    }
                    onPointerUp={() =>
                      void handleControlsChange({ confidenceThreshold })
                    }
                    onKeyUp={() =>
                      void handleControlsChange({ confidenceThreshold })
                    }
                  />
                  <div className="flex justify-between font-technical text-[10px] text-muted-foreground">
                    <span>0,0</span>
                    <span>0,5</span>
                    <span>1,0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Upload" />
          <div className="rounded-xl border border-hairline bg-muted/40 p-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
            />
            <div
              role="button"
              tabIndex={0}
              aria-label="Arraste arquivos ou clique para enviar"
              onClick={() => !busy && fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                void handleUpload(event.dataTransfer.files);
              }}
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
                dragOver
                  ? "border-hairline-strong bg-surface-raise-2"
                  : "border-hairline bg-muted/20 hover:border-hairline-strong hover:bg-surface-hover",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="size-3.5" />
                {busy ? "Enviando…" : "Enviar arquivos"}
              </Button>
              <p className="font-technical text-[11px] text-muted-foreground">
                TXT, PDF ou XLSX · até 4 arquivos · 5 MB cada
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Sessões recentes" count={sessions.length} />
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-muted/20 px-4 py-8 text-center">
              <FileText className="size-5 text-muted-foreground/70" />
              <p className="text-xs font-medium">Nenhuma sessão ainda</p>
              <p className="max-w-xs text-[11px] text-muted-foreground">
                Envie um documento acima para a IA começar a extrair candidatos.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((session) => {
                const selected = selectedSessionId === session.id;
                const canCancel =
                  session.status === "PROCESSING" ||
                  session.status === "PENDING";
                const muted =
                  session.status === "CANCELLED" ||
                  session.status === "FAILED";
                return (
                  <li key={session.id} className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className={cn(
                        "group flex min-w-0 flex-1 items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors",
                        selected
                          ? "border-hairline-strong bg-surface-raise-2"
                          : "border-hairline bg-muted/40 hover:bg-surface-hover",
                      )}
                    >
                      <span className="font-technical text-xs text-foreground">
                        {new Date(session.createdAt).toLocaleString("pt-BR")}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-medium",
                            muted
                              ? "bg-muted/50 text-muted-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          {canCancel ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="size-2.5 animate-spin" />
                              {sessionStatusLabel(session.status)}
                            </span>
                          ) : (
                            sessionStatusLabel(session.status)
                          )}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {session.candidateCount} candidato
                          {session.candidateCount === 1 ? "" : "s"}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                    {canCancel ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        className="h-auto shrink-0 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        aria-label="Encerrar análise"
                        onClick={() => void handleCancelSession(session.id)}
                      >
                        <Square className="size-3" />
                        Encerrar
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {sessionDetail ? (
          <>
            <RuleReviewReasoningPanel
              session={sessionDetail}
              busy={busy}
              onCancel={() => void handleCancelSession(sessionDetail.id)}
            />

            <section className="space-y-4">
              <SectionHeading
                title="Checklist de candidatos"
                description="Ajuste destinos e aceite, negue ou desfaça promoções."
                count={sessionDetail.candidates.length}
                action={
                  pendingCount > 0 ? (
                    <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground">
                      {pendingCount} pendente{pendingCount === 1 ? "" : "s"}
                    </span>
                  ) : null
                }
              />

              {sessionDetail.candidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-hairline bg-muted/20 px-4 py-8 text-center">
                  <p className="text-xs font-medium">Nenhum candidato ainda</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Eles aparecem aqui conforme a IA classifica o documento.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sessionDetail.candidates.map((candidate) => {
                    const draft =
                      drafts[candidate.id] ?? buildDraft(candidate);
                    const isPending = candidate.status === "PENDING";
                    const isAccepted = candidate.status === "ACCEPTED";
                    const isRejected = candidate.status === "REJECTED";
                    const CategoryIcon =
                      candidate.category === "BUSINESS_RULE"
                        ? Scale
                        : BookOpen;

                    return (
                      <article
                        key={candidate.id}
                        className={cn(
                          "rounded-xl border border-hairline bg-muted/40 p-4 transition-opacity",
                          !isPending && "opacity-70",
                        )}
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                            <CategoryIcon className="size-3.5" />
                            {candidateCategoryLabel(candidate.category)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-0.5 font-technical text-[11px] font-medium tabular-nums text-muted-foreground">
                            <Sparkles className="size-3" />
                            {Math.round(candidate.confidence * 100)}%
                          </span>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-medium",
                              isPending && "bg-muted text-foreground",
                              isAccepted &&
                                "bg-accent-active text-accent-active-foreground",
                              isRejected &&
                                "bg-muted/50 text-muted-foreground line-through",
                            )}
                          >
                            {isAccepted ? (
                              <span className="inline-flex items-center gap-1">
                                <Check className="size-3" />
                                {candidateStatusLabel(candidate.status)}
                              </span>
                            ) : (
                              candidateStatusLabel(candidate.status)
                            )}
                          </span>
                          {candidate.promotionSource ? (
                            <span className="rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {candidate.promotionSource === "AUTO"
                                ? "Auto"
                                : "Manual"}
                            </span>
                          ) : null}
                        </div>

                        <input
                          value={isPending ? draft.title : candidate.title}
                          disabled={!isPending}
                          onChange={(event) =>
                            updateDraft(candidate.id, {
                              title: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-hairline bg-neutral-deep px-3 py-2.5 text-xs font-medium text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-80"
                          aria-label="Título do candidato"
                        />
                        <textarea
                          value={
                            isPending ? draft.content : candidate.content
                          }
                          disabled={!isPending}
                          onChange={(event) =>
                            updateDraft(candidate.id, {
                              content: event.target.value,
                            })
                          }
                          rows={2}
                          className="mt-2 w-full resize-y rounded-lg border border-hairline bg-neutral-deep px-3 py-2.5 text-xs leading-relaxed text-muted-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-80"
                          aria-label="Conteúdo do candidato"
                        />

                        {isPending && candidate.sourceExcerpt ? (
                          <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground">
                            Trecho: {candidate.sourceExcerpt}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-5">
                          <PromoteCheck
                            checked={
                              isPending
                                ? draft.promoteToRule
                                : candidate.promoteToRule === true
                            }
                            disabled={!isPending}
                            label="Promover para regra"
                            onChange={(next) =>
                              updateDraft(candidate.id, {
                                promoteToRule: next,
                              })
                            }
                          />
                          <PromoteCheck
                            checked={
                              isPending
                                ? draft.promoteToKnowledge
                                : candidate.promoteToKnowledge === true
                            }
                            disabled={!isPending}
                            label="Promover para knowledge"
                            onChange={(next) =>
                              updateDraft(candidate.id, {
                                promoteToKnowledge: next,
                              })
                            }
                          />
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleAccept(candidate)}
                                className="rounded-lg bg-accent-active px-4 py-2 text-xs font-semibold text-accent-active-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                              >
                                Aceitar
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleReject(candidate)}
                                className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
                              >
                                Negar
                              </button>
                            </>
                          ) : isAccepted ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleUndo(candidate)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
                            >
                              <Undo2 className="size-3.5" />
                              Desfazer
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : sessions.length > 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-muted/20 px-4 py-10 text-center">
            <Sparkles className="size-5 text-muted-foreground/70" />
            <p className="text-xs font-medium">Selecione uma sessão</p>
            <p className="max-w-xs text-[11px] text-muted-foreground">
              O raciocínio e o checklist aparecem aqui quando você abre uma
              análise.
            </p>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}
