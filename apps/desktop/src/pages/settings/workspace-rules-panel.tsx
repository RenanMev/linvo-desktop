import { useEffect, useRef, useState } from "react";
import type { BusinessRule } from "@linvo/shared";
import { ChevronDown, Plus, ScrollText, Trash2, X } from "lucide-react";

import { SettingsEmpty } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@/lib/utils";
import { rulesCopy } from "@/lib/workspace/workspace-rules-copy";

type WorkspaceRulesPanelProps = {
  rules: BusinessRule[];
  busy: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onDelete: (ruleId: string) => Promise<void>;
  onCreate: (input: { title: string; content: string }) => Promise<void>;
};

export function WorkspaceRulesPanel({
  rules,
  busy,
  canWrite,
  canDelete,
  onClose,
  onDelete,
  onCreate,
}: WorkspaceRulesPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useFocusTrap(containerRef, { active: true, initialFocusRef: closeRef });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleCreate() {
    if (!title.trim() || !content.trim()) return;
    await onCreate({ title: title.trim(), content: content.trim() });
    setTitle("");
    setContent("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-6 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-rules-title"
        className="flex max-h-[min(36rem,calc(100%-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-hairline bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="workspace-rules-title"
              className="text-sm font-semibold tracking-tight"
            >
              {rulesCopy.catalogTitle}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {rules.length === 0
                ? rulesCopy.catalogEmpty
                : rules.length === 1
                  ? rulesCopy.catalogOne
                  : rulesCopy.catalogMany(rules.length)}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Fechar"
            aria-label="Fechar regras"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5 px-2 pb-3">
            {rules.length === 0 ? (
              <SettingsEmpty
                icon={<ScrollText className="size-5 text-muted-foreground/70" />}
                title={rulesCopy.catalogEmptyTitle}
                description={rulesCopy.catalogEmptyHint}
              />
            ) : (
              rules.map((rule) => {
                const expanded = openRuleId === rule.id;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "rounded-lg px-2.5 py-2 transition-colors",
                      expanded ? "bg-surface-raise-1" : "hover:bg-surface-hover",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`Ver regra ${rule.title}`}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        onClick={() =>
                          setOpenRuleId(expanded ? null : rule.id)
                        }
                      >
                        <ChevronDown
                          className={cn(
                            "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-180",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {rule.title}
                          </span>
                          {expanded ? (
                            <span className="mt-1.5 block whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
                              {rule.content}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      {canDelete ? (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          disabled={busy}
                          aria-label={`Remover regra ${rule.title}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => void onDelete(rule.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {canWrite ? (
          <div className="space-y-2.5 border-t border-hairline px-4 py-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título da regra"
              className="h-8 text-xs"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Descreva a regra de negócio..."
              rows={3}
              className={cn(
                "min-h-20 w-full resize-y rounded-lg border border-hairline bg-surface-raise-1 px-3 py-2 text-xs leading-relaxed outline-none",
                "placeholder:text-muted-foreground",
                "focus-visible:border-hairline-strong focus-visible:ring-[2px] focus-visible:ring-ring/30",
              )}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={busy || !title.trim() || !content.trim()}
                onClick={() => void handleCreate()}
              >
                <Plus className="size-3.5" />
                Adicionar regra
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
