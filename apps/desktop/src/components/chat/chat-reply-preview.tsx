import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { replyAuthorLabel, truncateReplyContent } from "@/lib/chat/chat-state";
import type { ChatReplyRef } from "@/lib/chat/types";

type ChatReplyPreviewProps = {
  replyTarget: ChatReplyRef;
  onCancel: () => void;
};

export function ChatReplyPreview({ replyTarget, onCancel }: ChatReplyPreviewProps) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-xl border bg-muted/50 px-3 py-2">
      <div className="min-w-0 flex-1 border-l-2 border-primary pl-3">
        <p className="text-xs font-medium text-primary">
          Respondendo {replyAuthorLabel(replyTarget.role)}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {truncateReplyContent(replyTarget.content, 100)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onCancel}
        title="Cancelar resposta"
        className="shrink-0"
      >
        <X />
      </Button>
    </div>
  );
}
