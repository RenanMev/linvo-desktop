import { LinvoLogo } from "@/components/linvo-logo";

type ChatEmptyStateProps = {
  onSuggestion: (prompt: string) => void;
  disabled?: boolean;
};

export function ChatEmptyState(_props: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-8">
      <div className="flex max-w-sm flex-col items-center space-y-3 text-center">
        <LinvoLogo className="size-10 opacity-80 dark:invert" />
        <div className="space-y-1">
          <h2 className="text-base font-medium tracking-tight text-foreground/90">
            Como posso ajudar?
          </h2>
          <p className="text-xs text-muted-foreground">
            Envie uma mensagem para iniciar a conversa.
          </p>
        </div>
      </div>
    </div>
  );
}
