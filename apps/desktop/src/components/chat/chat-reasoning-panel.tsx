import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Check,
  ChevronDown,
  LoaderCircle,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";

import { ChatMarkdown } from "@/components/chat/chat-markdown";
import type { ChatActivity, ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatReasoningPanelProps = {
  activities?: ChatActivity[];
  reasoning?: string;
  toolUses?: ChatMessage["toolUses"];
  model?: string;
  isStreaming: boolean;
};

type TimelineItem = {
  id: string;
  label: string;
  status: "running" | "done";
  detail?: string;
  kind: "research" | "tool" | "think";
};

function ActivityIcon({
  kind,
  status,
}: {
  kind: TimelineItem["kind"];
  status: TimelineItem["status"];
}) {
  if (status === "running") {
    return (
      <LoaderCircle
        className="size-3.5 shrink-0 animate-spin text-foreground"
        aria-hidden
      />
    );
  }
  if (kind === "research") {
    return <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (kind === "think") {
    return <Brain className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <Wrench className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}

function buildTimeline(
  activities: ChatActivity[],
  toolUses: NonNullable<ChatMessage["toolUses"]>,
): TimelineItem[] {
  if (activities.length > 0) {
    return activities.map((activity) => ({
      id: activity.id,
      label: activity.label,
      status: activity.status,
      detail: activity.detail,
      kind: activity.kind ?? (activity.id === "start" ? "think" : "tool"),
    }));
  }

  return toolUses.map((tool, index) => ({
    id: `tool-${tool.name}-${index}`,
    label: tool.label,
    status: "done" as const,
    kind: "tool" as const,
  }));
}

function buildSummary(input: {
  isStreaming: boolean;
  timeline: TimelineItem[];
  toolUses: NonNullable<ChatMessage["toolUses"]>;
  hasReasoning: boolean;
  model?: string;
}): string {
  const live = [...input.timeline]
    .reverse()
    .find((item) => item.status === "running");

  if (input.isStreaming) {
    const liveLabel = live?.label ?? "Analisando…";
    return input.model ? `${input.model} · ${liveLabel}` : liveLabel;
  }

  const parts: string[] = [];
  if (input.model) {
    parts.push(input.model);
  }
  if (input.toolUses.length > 0) {
    const lastLabel = input.toolUses[input.toolUses.length - 1]?.label;
    parts.push(
      `${input.toolUses.length} skill${input.toolUses.length > 1 ? "s" : ""}${
        lastLabel ? ` · ${lastLabel}` : ""
      }`,
    );
  } else if (input.timeline.length > 0) {
    const doneLabels = input.timeline
      .filter((item) => item.status === "done" && item.id !== "start")
      .map((item) => item.label);
    if (doneLabels.length > 0) {
      parts.push(doneLabels[doneLabels.length - 1]!);
    }
  }

  if (input.hasReasoning) {
    parts.push("Raciocínio");
  }

  return parts.join(" · ") || "Raciocínio";
}

export function ChatReasoningPanel({
  activities = [],
  reasoning,
  toolUses = [],
  model,
  isStreaming,
}: ChatReasoningPanelProps) {
  const hasActivities = activities.length > 0;
  const hasReasoning = Boolean(reasoning?.trim());
  const hasTools = (toolUses?.length ?? 0) > 0;
  const hasContent = hasActivities || hasReasoning || hasTools || Boolean(model);
  const timeline = buildTimeline(activities, toolUses ?? []);
  const reasoningLong = (reasoning?.trim().length ?? 0) > 280;

  const userToggledRef = useRef(false);
  const [collapsed, setCollapsed] = useState(!isStreaming);

  useEffect(() => {
    if (isStreaming) {
      userToggledRef.current = false;
      setCollapsed(false);
      return;
    }
    if (userToggledRef.current) {
      return;
    }
    if (hasContent && reasoningLong) {
      setCollapsed(true);
    } else if (hasContent) {
      setCollapsed(false);
    }
  }, [isStreaming, hasContent, reasoningLong]);

  if (!hasContent && !isStreaming) {
    return null;
  }

  const summaryLabel = buildSummary({
    isStreaming,
    timeline,
    toolUses: toolUses ?? [],
    hasReasoning,
    model,
  });

  return (
    <div className="mb-3 w-full min-w-[12rem] overflow-hidden rounded-xl border border-border/70 bg-background/50 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-background/40 hover:text-foreground"
        onClick={() => {
          userToggledRef.current = true;
          setCollapsed((value) => !value);
        }}
      >
        <Sparkles className="size-3.5 shrink-0 text-foreground/70" aria-hidden />
        <span className="flex-1 truncate font-medium text-foreground/80">
          {summaryLabel}
        </span>
        {isStreaming && !collapsed ? (
          <span className="flex gap-1" aria-hidden>
            <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            collapsed ? "-rotate-90" : "rotate-0",
          )}
          aria-hidden
        />
      </button>

      {!collapsed && (
        <div className="space-y-2.5 border-t border-border/50 px-3 py-2.5">
          {timeline.length > 0 ? (
            <ul className="space-y-1.5">
              {timeline.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2 text-muted-foreground",
                    item.status === "running" && "text-foreground",
                  )}
                >
                  <ActivityIcon kind={item.kind} status={item.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{item.label}</span>
                      {item.status === "done" ? (
                        <Check
                          className="size-3 shrink-0 text-muted-foreground/70"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    {item.detail ? (
                      <p className="truncate text-[0.7rem] text-muted-foreground/80">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {hasReasoning ? (
            <div className="max-h-48 overflow-y-auto rounded-lg bg-background/40 px-2 py-1.5">
              <ChatMarkdown
                content={reasoning!.trim()}
                className="text-xs text-muted-foreground [&_p]:my-1"
              />
            </div>
          ) : null}

          {timeline.length === 0 && !hasReasoning && isStreaming ? (
            <p className="text-muted-foreground">Analisando…</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
