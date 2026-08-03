type ChatToolbarProps = {
  title: string;
  model?: string | null;
  isResponding?: boolean;
};

export function ChatToolbar({
  title,
  model,
  isResponding = false,
}: ChatToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-tight">{title}</p>
        {model ? (
          <p className="truncate font-technical text-[10px] tracking-wide text-muted-foreground">
            {model}
            {isResponding ? " · em uso" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
