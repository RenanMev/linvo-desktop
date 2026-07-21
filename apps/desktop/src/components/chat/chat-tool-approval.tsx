import { Clipboard, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isCreateProcedureToolRequest,
  isOpenProcedureToolRequest,
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

export function ChatToolApproval({
  request,
  disabled = false,
  onApprove,
  onDeny,
}: ChatToolApprovalProps) {
  const isCreate = isCreateProcedureToolRequest(request);
  const isOpenProcedure = isOpenProcedureToolRequest(request);
  const createArgs = isCreate ? parseCreateProcedureArgs(request.args) : null;
  const procedureSlug = isOpenProcedure
    ? resolveProcedureSlugFromToolRequest(request)
    : null;

  return (
    <div className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2 text-foreground">
        {isCreate || isOpenProcedure ? (
          <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Clipboard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
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
          ) : isOpenProcedure ? (
            <span className="text-xs text-muted-foreground">
              {procedureSlug
                ? `Abrir checklist /${procedureSlug} no painel.`
                : "Abrir checklist do procedimento no painel."}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              O assistente pediu acesso à área de transferência.
            </span>
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
