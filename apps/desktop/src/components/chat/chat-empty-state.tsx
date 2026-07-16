type ChatEmptyStateProps = {
  onSuggestion: (prompt: string) => void;
  disabled?: boolean;
};

export function ChatEmptyState(_props: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-8">
      <div className="max-w-sm space-y-1 text-center">
        <h2 className="text-base font-medium tracking-tight text-foreground/90">
          Como posso ajudar?
        </h2>
        <p className="text-xs text-muted-foreground">
          Envie uma mensagem para iniciar a conversa.
        </p>
      </div>
    </div>
  );
}
