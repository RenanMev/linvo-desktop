import { Clipboard } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  return (
    <div className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2 text-foreground">
        <Clipboard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{request.label}</span>
          <span className="text-xs text-muted-foreground">
            O assistente pediu acesso à área de transferência.
          </span>
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
