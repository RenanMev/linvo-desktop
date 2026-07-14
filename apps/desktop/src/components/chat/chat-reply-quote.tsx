import { replyAuthorLabel, truncateReplyContent } from "@/lib/chat/chat-state";
import type { ChatReplyRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatReplyQuoteProps = {
  replyTo: ChatReplyRef;
  isUser: boolean;
};

export function ChatReplyQuote({ replyTo, isUser }: ChatReplyQuoteProps) {
  return (
    <div
      className={cn(
        "mb-2 rounded-lg border-l-2 px-3 py-2 text-xs",
        isUser
          ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/90"
          : "border-foreground/20 bg-background/60 text-muted-foreground",
      )}
    >
      <p className="font-medium">{replyAuthorLabel(replyTo.role)}</p>
      <p className="mt-0.5 line-clamp-2">{truncateReplyContent(replyTo.content, 160)}</p>
    </div>
  );
}
