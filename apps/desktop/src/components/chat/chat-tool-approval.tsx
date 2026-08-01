import { useState } from "react";
import { ChevronDown, Clipboard, FileText, ListChecks, Wrench } from "lucide-react";

import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isCreateProcedureToolRequest,
  parseCreateProcedureArgs,
  resolveProcedureSlugFromToolRequest,
} from "@/lib/chat/procedure-tool-request";
import type { ChatToolRequest } from "@/lib/chat/types";

type ChatToolApprovalProps = {
  request: ChatToolRequest;
  disabled?: boolean;
  onApprove: () => void;
  onDeny: () => void;
};

function formatArgsPreview(args: Record<string, unknown>): string | null {
  const entries = Object.entries(args).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) {
    return null;
  }
  return entries
    .slice(0, 4)
    .map(([key, value]) => {
      const text =
        typeof value === "string" ? value : JSON.stringify(value);
      const clipped = text.length > 80 ? `${text.slice(0, 80)}…` : text;
      return `${key}: ${clipped}`;
    })
    .join(" · ");
}

function parseGeneratePdfArgs(
  args: Record<string, unknown>,
): { title: string; markdown: string } | null {
  const title = typeof args.title === "string" ? args.title.trim() : "";
  const markdown = typeof args.markdown === "string" ? args.markdown : "";
  if (!title || !markdown) {
    return null;
  }
  return { title, markdown };
}

export function ChatToolApproval({
  request,
  disabled = false,
  onApprove,
  onDeny,
}: ChatToolApprovalProps) {
  const [showPreview, setShowPreview] = useState(false);
  const isCreate = isCreateProcedureToolRequest(request);
  const isOpenProcedure = request.name === "open_procedure";
  const isClipboard = request.name === "read_clipboard";
  const isGeneratePdf = request.name === "generate_pdf";
  const createArgs = isCreate ? parseCreateProcedureArgs(request.args) : null;
  const pdfArgs = isGeneratePdf ? parseGeneratePdfArgs(request.args) : null;
  const procedureSlug = isOpenProcedure
    ? resolveProcedureSlugFromToolRequest(request)
    : null;
  const argsPreview =
    !isCreate && !isOpenProcedure && !isClipboard && !pdfArgs
      ? formatArgsPreview(request.args)
      : null;

  const Icon = isGeneratePdf
    ? FileText
    : isCreate || isOpenProcedure
      ? ListChecks
      : isClipboard
        ? Clipboard
        : Wrench;

  return (
    <div className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-neutral-deep px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2 text-foreground">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{request.label}</span>
          {isCreate && createArgs ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Criar procedimento publicado:</p>
              <p className="font-medium text-foreground">{createArgs.title}</p>
              {createArgs.steps && createArgs.steps.length > 0 ? (
                <ol className="list-decimal space-y-0.5 pl-4">
                  {createArgs.steps.slice(0, 6).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                  {createArgs.steps.length > 6 ? (
                    <li>… +{createArgs.steps.length - 6} passos</li>
                  ) : null}
                </ol>
              ) : (
                <p className="line-clamp-4 whitespace-pre-wrap">
                  {createArgs.markdown}
                </p>
              )}
            </div>
          ) : pdfArgs ? (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>Gerar um PDF para download:</p>
              <p className="font-medium text-foreground">{pdfArgs.title}</p>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                aria-expanded={showPreview}
                onClick={() => setShowPreview((previous) => !previous)}
              >
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    showPreview && "rotate-180",
                  )}
                  aria-hidden
                />
                {showPreview ? "Ocultar prévia" : "Ver prévia"}
              </button>
              {showPreview ? (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-hairline bg-popover px-2 py-1.5">
                  <ChatMarkdown content={pdfArgs.markdown} />
                </div>
              ) : null}
            </div>
          ) : isOpenProcedure ? (
            <span className="text-xs text-muted-foreground">
              {procedureSlug
                ? `Abrir checklist /${procedureSlug} no painel.`
                : "Abrir checklist do procedimento no painel."}
            </span>
          ) : isClipboard ? (
            <span className="text-xs text-muted-foreground">
              O assistente pediu acesso à área de transferência.
            </span>
          ) : (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>O assistente pediu aprovação para usar esta ferramenta.</p>
              {argsPreview ? (
                <p className="break-words font-mono text-[0.7rem] text-foreground/80">
                  {argsPreview}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={onApprove}
        >
          Aprovar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onDeny}
        >
          Recusar
        </Button>
      </div>
    </div>
  );
}
