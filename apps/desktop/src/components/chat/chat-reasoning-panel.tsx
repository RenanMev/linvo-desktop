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
        className="size-3.5 shrink-0 animate-spin text-muted-foreground"
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
  const isIdleStreaming =
    isStreaming && timeline.length === 0 && !hasReasoning && !hasTools;

  const userToggledRef = useRef(false);
  const [collapsed, setCollapsed] = useState(!isStreaming);

  useEffect(() => {
    if (isStreaming) {
      userToggledRef.current = false;
      setCollapsed(isIdleStreaming);
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
  }, [isStreaming, hasContent, reasoningLong, isIdleStreaming]);

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

  if (isIdleStreaming) {
    return (
      <div
        className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"
        aria-live="polite"
      >
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden />
        <span className="truncate">{summaryLabel}</span>
      </div>
    );
  }

  const showBody =
    !collapsed && (timeline.length > 0 || hasReasoning);

  return (
    <div className="mb-2 w-full min-w-[12rem] text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => {
          userToggledRef.current = true;
          setCollapsed((value) => !value);
        }}
      >
        {isStreaming ? (
          <LoaderCircle
            className="size-3.5 shrink-0 animate-spin"
            aria-hidden
          />
        ) : (
          <Sparkles className="size-3.5 shrink-0 text-foreground/60" aria-hidden />
        )}
        <span className="flex-1 truncate font-medium text-foreground/75">
          {summaryLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-60 transition-transform",
            collapsed ? "-rotate-90" : "rotate-0",
          )}
          aria-hidden
        />
      </button>

      {showBody ? (
        <div className="mt-1.5 space-y-2 border-l border-hairline pl-3 ml-1.5">
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
            <div className="max-h-48 overflow-y-auto">
              <ChatMarkdown
                content={reasoning!.trim()}
                className="text-xs text-muted-foreground [&_p]:my-1"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
