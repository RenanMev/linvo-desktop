import type { ChatCitation, ChatCitationKind } from "@/lib/chat/types";
import { openPanel } from "@/lib/panel-window";

type ChatCitationsProps = {
  citations?: ChatCitation[];
  workspaceId?: string | null;
};

function citationRoute(kind: ChatCitationKind, workspaceId: string): string {
  if (kind === "procedure") {
    return `/settings/workspace/${workspaceId}/procedures`;
  }
  return `/settings/workspace/${workspaceId}`;
}

export function ChatCitations({ citations, workspaceId }: ChatCitationsProps) {
  if (citations === undefined) {
    return null;
  }

  if (citations.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Não encontrei na base</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {citations.map((citation) => (
        <button
          key={citation.id}
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-hairline bg-neutral-raised px-2 py-0.5 text-xs text-foreground/80 transition-colors hover:border-hairline-strong hover:text-foreground"
          onClick={() => {
            const route =
              citation.href ??
              (workspaceId ? citationRoute(citation.kind, workspaceId) : null);
            if (route) {
              void openPanel(route);
            }
          }}
        >
          {citation.label}
        </button>
      ))}
    </div>
  );
}
