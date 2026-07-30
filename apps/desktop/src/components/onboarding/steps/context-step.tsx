import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  OnboardingRule,
  OnboardingRulePreset,
} from "@/hooks/use-onboarding-flow";

const RULE_PRESETS: OnboardingRulePreset[] = [
  {
    title: "Tom de atendimento",
    content:
      "Responda de forma clara, acolhedora e objetiva, sem prometer o que não pode ser cumprido.",
  },
  {
    title: "Política de escalonamento",
    content:
      "Escalone casos com risco financeiro, jurídico ou de segurança para uma pessoa responsável.",
  },
  {
    title: "Horário de atendimento",
    content:
      "Nosso horário de atendimento é de segunda a sexta, das 9h às 18h.",
  },
];

type ContextStepProps = {
  rules: OnboardingRule[];
  busy: boolean;
  error: string | null;
  onAddRule: (preset?: OnboardingRulePreset) => void;
  onUpdateRule: (
    id: string,
    patch: Partial<Pick<OnboardingRule, "title" | "content">>,
  ) => void;
  onRemoveRule: (id: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
};

export function ContextStep({
  rules,
  busy,
  error,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onConfirm,
  onSkip,
}: ContextStepProps) {
  const visibleRules = rules.filter((rule) => rule.status !== "saved");
  const failedCount = visibleRules.filter(
    (rule) => rule.status === "error",
  ).length;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-4 space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Adicione contexto inicial
        </h1>
        <p className="text-sm text-text-secondary">
          Registre regras que o assistente deve considerar em todas as
          respostas deste workspace.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {RULE_PRESETS.map((preset) => (
          <button
            key={preset.title}
            type="button"
            onClick={() => onAddRule(preset)}
            className="rounded-full border border-hairline bg-surface-raise-1 px-3 py-1.5 text-xs text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {preset.title}
          </button>
        ))}
      </div>

      <div className="scrollbar-elegant min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {visibleRules.map((rule, index) => (
          <article
            key={rule.id}
            className="space-y-2 rounded-xl border border-hairline bg-surface-raise-1 p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                value={rule.title}
                autoFocus={index === 0}
                aria-label={`Título da regra ${index + 1}`}
                placeholder="Título da regra"
                onChange={(event) =>
                  onUpdateRule(rule.id, { title: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Remover regra"
                onClick={() => onRemoveRule(rule.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <textarea
              value={rule.content}
              rows={3}
              aria-label={`Conteúdo da regra ${index + 1}`}
              placeholder="O que o Linvo deve saber?"
              onChange={(event) =>
                onUpdateRule(rule.id, { content: event.target.value })
              }
              className="w-full resize-none rounded-xl border border-hairline bg-surface-raise-2 px-3 py-2 text-sm outline-none placeholder:text-text-tertiary focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {rule.status === "error" ? (
              <p className="text-xs text-destructive">
                Não foi possível salvar esta regra. Tente novamente.
              </p>
            ) : null}
          </article>
        ))}

        {visibleRules.length === 0 ? (
          <button
            type="button"
            autoFocus
            onClick={() => onAddRule()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-surface-raise-1 px-4 py-6 text-sm text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" />
            Adicionar regra
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddRule()}
          >
            <Plus className="size-3.5" />
            Adicionar outra regra
          </Button>
        )}

        {failedCount > 0 || error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error ??
              `${failedCount} ${
                failedCount === 1 ? "regra falhou" : "regras falharam"
              } ao salvar`}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onSkip}
        >
          Pular por agora
        </Button>
        <Button type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </section>
  );
}
