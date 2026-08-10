import { Plus, Trash2 } from "lucide-react";

import {
  StepActions,
  StepHeader,
  StepLink,
  StepPrimary,
} from "@/components/onboarding/step-shell";
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
  onBack?: () => void;
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
  onBack,
}: ContextStepProps) {
  const visibleRules = rules.filter((rule) => rule.status !== "saved");
  const failedCount = visibleRules.filter(
    (rule) => rule.status === "error",
  ).length;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <StepHeader
        title="Adicione contexto inicial"
        description="Regras que o assistente considera em todas as respostas deste workspace."
      />

      <div className="scrollbar-elegant -mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
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
                className="h-8 rounded-lg border-transparent bg-transparent px-0 text-[13px] font-medium shadow-none hover:bg-transparent focus-visible:translate-y-0 focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0"
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
              className="w-full resize-none rounded-lg border border-hairline bg-surface-raise-2 px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-text-tertiary focus-visible:border-hairline-strong focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {rule.status === "error" ? (
              <p className="text-[11px] text-destructive">
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-dashed px-4 py-7 text-[13px] font-medium text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Plus className="size-4" aria-hidden />
            Escrever uma regra
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

        <div className="space-y-2 pt-1">
          <p className="text-[11px] text-text-tertiary">
            Ou comece por uma sugestão
          </p>
          <div className="flex flex-wrap gap-2">
            {RULE_PRESETS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => onAddRule(preset)}
                className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Plus className="size-3 shrink-0" aria-hidden />
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {failedCount > 0 || error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
          >
            {error ??
              `${failedCount} ${
                failedCount === 1 ? "regra falhou" : "regras falharam"
              } ao salvar`}
          </p>
        ) : null}
      </div>

      <StepActions
        links={
          <>
            {onBack ? (
              <StepLink disabled={busy} onClick={onBack}>
                Voltar
              </StepLink>
            ) : null}
            <StepLink disabled={busy} onClick={onSkip}>
              Pular por agora
            </StepLink>
          </>
        }
      >
        <StepPrimary disabled={busy} onClick={onConfirm}>
          {busy ? "Salvando..." : "Continuar"}
        </StepPrimary>
      </StepActions>
    </section>
  );
}
