import { Loader2, Send, Sparkles, Square } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useQuickPrompt } from "@/hooks/use-quick-prompt";

type FirstQuestionStepProps = {
  workspaceName: string;
  busy: boolean;
  finish: (routeOverride?: string) => Promise<void>;
};

export function FirstQuestionStep({
  workspaceName,
  busy,
  finish,
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
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg border border-hairline bg-surface-raise-1">
            <Sparkles className="size-3.5 text-text-secondary" />
          </span>
          <p className="font-technical text-[11px] uppercase tracking-wider text-text-tertiary">
            Última etapa
          </p>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Faça sua primeira pergunta real
        </h1>
        <p className="text-sm text-text-secondary">
          O Linvo já pode responder usando o contexto de {label}.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={streaming}
            onClick={() => setQuestion(suggestion)}
            className="rounded-full border border-hairline bg-surface-raise-1 px-3 py-1.5 text-left text-xs text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-hairline bg-surface-raise-1 p-3">
        <textarea
          value={question}
          autoFocus
          rows={3}
          aria-label="Sua primeira pergunta"
          placeholder="Pergunte alguma coisa..."
          disabled={streaming}
          onChange={(event) => setQuestion(event.target.value)}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-text-tertiary disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
          <span className="text-[11px] text-text-tertiary">
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

      {prompt.isThinking ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
          <Loader2 className="size-3.5 animate-spin" />
          Pensando...
        </div>
      ) : null}

      {prompt.responseText ? (
        <div
          aria-live="polite"
          className="scrollbar-elegant mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-hairline bg-surface-raise-2 p-3"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {prompt.responseText}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      {prompt.errorMessage ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {prompt.errorMessage}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end border-t border-hairline pt-4">
        <Button
          type="button"
          disabled={busy || streaming}
          onClick={() => void handleFinish()}
        >
          {canOpenConversation
            ? "Concluir e abrir no chat"
            : "Concluir sem pergunta"}
        </Button>
      </div>
    </section>
  );
}
