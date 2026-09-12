import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type CaptureSummaryProps = {
  bullets?: string[];
};

export function CaptureSummary({ bullets }: CaptureSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!bullets?.length) {
    return null;
  }

  const items = bullets.slice(0, 3);

  return (
    <div className="mb-2 w-full min-w-[12rem] text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span className="flex-1 truncate font-medium text-foreground/75">
          Resumo do print
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-60 transition-transform",
            collapsed ? "-rotate-90" : "rotate-0",
          )}
          aria-hidden
        />
      </button>
      {collapsed ? null : (
        <ul className="mt-1.5 list-disc space-y-1 border-l border-hairline pl-4 ml-1.5 text-muted-foreground">
          {items.map((bullet, index) => (
            <li key={`${index}-${bullet}`}>{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
