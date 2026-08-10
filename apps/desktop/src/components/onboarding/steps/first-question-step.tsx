import { Loader2, Send, Square } from "lucide-react";
import { useEffect, useState } from "react";

import {
  StepActions,
  StepHeader,
  StepLink,
  StepPrimary,
} from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { useQuickPrompt } from "@/hooks/use-quick-prompt";

type FirstQuestionStepProps = {
  workspaceName: string;
  busy: boolean;
  finish: (routeOverride?: string) => Promise<void>;
  onBack?: () => void;
};

export function FirstQuestionStep({
  workspaceName,
  busy,
  finish,
  onBack,
}: FirstQuestionStepProps) {
  const prompt = useQuickPrompt();
  const [question, setQuestion] = useState("");
  const label = workspaceName.trim() || "seu workspace";
  const suggestions = [
    `Resuma as regras de ${label}`,
    `Crie um checklist para o atendimento de ${label}`,
    `O que devo priorizar hoje em ${label}?`,
  ];
  const streaming = prompt.status === "streaming";
  const canOpenConversation = Boolean(prompt.conversationId);

  useEffect(
    () => () => {
      prompt.reset();
    },
    [prompt.reset],
  );

  async function handleSend() {
    if (!question.trim() || streaming) {
      return;
    }
    await prompt.send(question);
  }

  async function handleFinish() {
    await finish(
      prompt.conversationId
        ? `/chat/${prompt.conversationId}`
        : undefined,
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <StepHeader
        title="Faça sua primeira pergunta real"
        description={`O Linvo já pode responder usando o contexto de ${label}.`}
      />

      <div className="scrollbar-elegant -mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
        <div className="rounded-xl border border-hairline bg-surface-raise-1 p-3 shadow-inner-light">
          <textarea
            value={question}
            autoFocus
            rows={3}
            aria-label="Sua primeira pergunta"
            placeholder="Pergunte alguma coisa..."
            disabled={streaming}
            onChange={(event) => setQuestion(event.target.value)}
            className="w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-text-tertiary disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
            <span className="font-technical text-[10px] text-text-tertiary">
              Enter adiciona uma linha
            </span>
            {streaming ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={prompt.stop}
              >
                <Square className="size-3.5" />
                Parar
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={!question.trim()}
                onClick={() => void handleSend()}
              >
                <Send className="size-3.5" />
                Enviar
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={streaming}
              onClick={() => setQuestion(suggestion)}
              className="rounded-full border border-hairline px-3 py-1.5 text-left text-[12px] text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {prompt.isThinking ? (
          <div className="flex items-center gap-2 text-[12px] text-text-secondary">
            <Loader2 className="size-3.5 animate-spin" />
            Pensando...
          </div>
        ) : null}

        {prompt.responseText ? (
          <div
            aria-live="polite"
            className="rounded-xl border border-hairline bg-surface-raise-2 p-3"
          >
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
              {prompt.responseText}
            </p>
          </div>
        ) : null}

        {prompt.errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
          >
            {prompt.errorMessage}
          </p>
        ) : null}
      </div>

      <StepActions
        links={
          onBack ? (
            <StepLink disabled={busy || streaming} onClick={onBack}>
              Voltar
            </StepLink>
          ) : undefined
        }
      >
        <StepPrimary
          disabled={busy || streaming}
          onClick={() => void handleFinish()}
        >
          {canOpenConversation
            ? "Concluir e abrir no chat"
            : "Concluir sem pergunta"}
        </StepPrimary>
      </StepActions>
    </section>
  );
}
