import { useEffect, useMemo, useState } from "react";
import type {
  RuleDiscoveryEvent,
  RuleDiscoverySessionDetail,
} from "@linvo/shared";
import {
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileText,
  ScanSearch,
  Sparkles,
  Square,
  Tag,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildDocumentStages,
  countAutoPromoted,
  countDocumentsDone,
  getActiveDocumentId,
  getDocumentChipStatus,
  getLiveStep,
  getLiveStepDetail,
  getSessionSummaryEvent,
  readReasoningCollapsedPreference,
  writeReasoningCollapsedPreference,
  type DocumentStageStatus,
} from "@/lib/workspace/rule-review-reasoning";

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
    case "CANCELLED":
      return "Encerrada";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function eventTypeTag(type: RuleDiscoveryEvent["type"]): string {
  return type.split("_").join(" ").toUpperCase();
}

function eventIcon(type: RuleDiscoveryEvent["type"]) {
  switch (type) {
    case "document_reading":
    case "document_extracted":
      return ScanSearch;
    case "candidate_found":
    case "thinking":
    case "auto_promoted":
    case "auto_skipped":
      return Sparkles;
    case "classified":
      return Tag;
    case "document_done":
      return FileCheck2;
    case "session_started":
    case "session_ready":
    case "session_failed":
    case "session_cancelled":
      return CheckCircle2;
    case "candidate_undone":
      return Undo2;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function chipStatusClass(status: DocumentStageStatus): string {
  switch (status) {
    case "active":
      return "border-hairline-strong bg-surface-raise-2 text-foreground";
    case "done":
      return "border-hairline bg-muted/50 text-foreground";
    case "failed":
      return "border-hairline bg-muted/30 text-muted-foreground";
    case "pending":
      return "border-hairline bg-muted/30 text-muted-foreground";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function stageStatusLabel(status: DocumentStageStatus): string {
  switch (status) {
    case "active":
      return "Analisando";
    case "done":
      return "Concluído";
    case "failed":
      return "Falhou";
    case "pending":
      return "Aguardando";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function TypingDots() {
  return (
    <span className="flex gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
    </span>
  );
}

type RuleReviewReasoningPanelProps = {
  session: RuleDiscoverySessionDetail;
  busy: boolean;
  onCancel: () => void;
};

export function RuleReviewReasoningPanel({
  session,
  busy,
  onCancel,
}: RuleReviewReasoningPanelProps) {
  const [collapsed, setCollapsed] = useState(readReasoningCollapsedPreference);
  const [showFullLog, setShowFullLog] = useState(false);

  const isProcessing =
    session.status === "PROCESSING" || session.status === "PENDING";
  const isFinished =
    session.status === "READY" ||
    session.status === "FAILED" ||
    session.status === "CANCELLED";

  const liveStep = getLiveStep(session.events, isProcessing);
  const liveDetail = getLiveStepDetail(liveStep);
  const LiveIcon = liveStep ? eventIcon(liveStep.type) : Sparkles;
  const documentsDone = countDocumentsDone(session.events);
  const documentTotal = session.documents.length;
  const progressPct =
    documentTotal > 0
      ? Math.round((documentsDone / documentTotal) * 100)
      : 0;
  const candidateCount = session.candidates.length;
  const autoPromotedCount = countAutoPromoted(session.events);
  const summaryEvent = getSessionSummaryEvent(session.events);
  const documentStages = buildDocumentStages(
    session.events,
    session.documents,
    session.status,
  );
  const activeDocumentId = getActiveDocumentId(
    session.events,
    session.documents,
  );
  const doneDocumentIds = useMemo(
    () =>
      new Set(
        session.events
          .filter((event) => event.type === "document_done")
          .map((event) => {
            const payload = event.payload as { documentId?: unknown } | null;
            return typeof payload?.documentId === "string"
              ? payload.documentId
              : null;
          })
          .filter((id): id is string => Boolean(id)),
      ),
    [session.events],
  );

  useEffect(() => {
    writeReasoningCollapsedPreference(collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (isProcessing) {
      setShowFullLog(false);
    }
  }, [isProcessing, session.id]);

  return (
    <section className="surface-premium overflow-hidden rounded-xl">
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
            <Sparkles className="size-4 text-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Raciocínio</h2>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  collapsed && "-rotate-90",
                )}
              />
            </div>
            {collapsed && liveStep ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {liveStep.message}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Passo a passo da análise desta sessão.
              </p>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
              isProcessing
                ? "bg-muted/50 text-muted-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full bg-foreground",
                isProcessing && "animate-pulse bg-progress",
              )}
            />
            {isProcessing ? "Analisando" : sessionStatusLabel(session.status)}
          </span>
          {isProcessing ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-7 gap-1.5 text-[11px]"
              onClick={onCancel}
            >
              <Square className="size-3" />
              Encerrar
            </Button>
          ) : null}
        </div>
      </header>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
        )}
      >
        <div className="overflow-hidden">
          {session.documents.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-b border-hairline px-5 py-3">
              {session.documents.map((document) => {
                const chipStatus = getDocumentChipStatus(
                  document,
                  activeDocumentId,
                  doneDocumentIds,
                );
                return (
                  <span
                    key={document.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors duration-300",
                      chipStatusClass(chipStatus),
                      chipStatus === "active" && "animate-pulse",
                    )}
                  >
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="max-w-40 truncate">{document.originalName}</span>
                    <span
                      className={cn(
                        "font-technical text-[10px] uppercase tracking-wide",
                        document.status === "EXTRACTED"
                          ? "text-foreground"
                          : document.status === "FAILED"
                            ? "line-through text-muted-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {chipStatus === "active"
                        ? "ATIVO"
                        : document.status}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : null}

          {isProcessing ? (
            <div className="flex h-[200px] flex-col justify-between px-5 py-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Documentos</span>
                    <span className="font-technical tabular-nums">
                      {documentsDone}/{documentTotal || "—"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-raise-2">
                    <div
                      className="h-full rounded-full bg-progress transition-[width] duration-500 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {liveStep ? (
                  <div
                    key={liveStep.id}
                    className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-3 duration-300"
                  >
                    <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-border bg-muted text-foreground">
                      <LiveIcon className="size-4" />
                      <span className="absolute inset-0 animate-ping rounded-full border border-progress/40" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        {liveStep.message}
                      </p>
                      {liveDetail ? (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {liveDetail}
                        </p>
                      ) : null}
                      <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 font-technical text-[10px] uppercase tracking-wide text-muted-foreground">
                        {eventTypeTag(liveStep.type)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <TypingDots />
                    Aguardando os primeiros passos da análise…
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-hairline pt-3">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="font-technical text-lg font-medium tabular-nums transition-all duration-300">
                      {candidateCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">candidatos</p>
                  </div>
                  {autoPromotedCount > 0 ? (
                    <div className="text-center">
                      <p className="font-technical text-lg font-medium tabular-nums transition-all duration-300">
                        {autoPromotedCount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">auto</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <TypingDots />
                  analisando…
                </div>
              </div>
            </div>
          ) : null}

          {isFinished ? (
            <div className="space-y-3 px-5 py-4">
              {documentStages.length > 0 ? (
                <ul className="space-y-2">
                  {documentStages.map((stage) => (
                    <li
                      key={stage.documentId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-muted/30 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-xs">{stage.label}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {stage.candidateCount} candidato
                          {stage.candidateCount === 1 ? "" : "s"}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            stage.status === "done" && "bg-muted text-foreground",
                            stage.status === "failed" &&
                              "bg-muted/50 text-muted-foreground",
                            stage.status === "active" && "bg-muted text-foreground",
                            stage.status === "pending" &&
                              "bg-muted/50 text-muted-foreground",
                          )}
                        >
                          {stageStatusLabel(stage.status)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {summaryEvent ? (
                <p className="rounded-lg border border-hairline bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {summaryEvent.message}
                </p>
              ) : session.error ? (
                <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {session.error}
                </p>
              ) : null}

              <button
                type="button"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => setShowFullLog((prev) => !prev)}
              >
                {showFullLog ? "Ocultar log" : "Ver log completo"}
              </button>

              {showFullLog ? (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-hairline bg-muted/20 p-3">
                  <ol className="relative flex flex-col gap-2">
                    <span
                      aria-hidden
                      className="absolute top-2 bottom-2 left-[15px] w-px bg-border"
                    />
                    {session.events.map((event) => {
                      const Icon = eventIcon(event.type);
                      return (
                        <li
                          key={event.id}
                          className="relative flex items-start gap-3"
                        >
                          <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1 rounded-lg border border-hairline bg-muted/40 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-foreground">
                                {event.message}
                              </p>
                              <span className="shrink-0 font-technical text-[10px] uppercase tracking-wide text-muted-foreground">
                                {eventTypeTag(event.type)}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isProcessing && !isFinished && session.events.length === 0 ? (
            <div className="flex h-[120px] items-center gap-2 px-5 py-4 text-[11px] text-muted-foreground">
              <TypingDots />
              Aguardando os primeiros passos da análise…
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
