import { Clipboard, Globe, Search, Wrench } from "lucide-react";

import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatToolUsesProps = {
  toolUses: NonNullable<ChatMessage["toolUses"]>;
  isStreaming?: boolean;
};

function ToolIcon({ name }: { name: string }) {
  switch (name) {
    case "search_knowledge":
      return <Search className="size-3 shrink-0" aria-hidden />;
    case "web_search":
      return <Globe className="size-3 shrink-0" aria-hidden />;
    case "read_clipboard":
      return <Clipboard className="size-3 shrink-0" aria-hidden />;
    default:
      return <Wrench className="size-3 shrink-0" aria-hidden />;
  }
}

export function ChatToolUses({ toolUses, isStreaming = false }: ChatToolUsesProps) {
  if (toolUses.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {toolUses.map((tool, index) => (
        <span
          key={`${tool.name}-${index}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground",
            isStreaming && index === toolUses.length - 1 && "animate-pulse",
          )}
        >
          <ToolIcon name={tool.name} />
          <span>{tool.label}</span>
        </span>
      ))}
    </div>
  );
}
