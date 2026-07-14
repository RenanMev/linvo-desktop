import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

import { ChatReplyPreview } from "@/components/chat/chat-reply-preview";
import { Button } from "@/components/ui/button";
import { canSendMessage } from "@/lib/chat/chat-state";
import type { ChatReplyRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSend: (content: string) => void;
  isResponding: boolean;
  replyTarget: ChatReplyRef | null;
  onCancelReply: () => void;
  disabled?: boolean;
};

export function ChatInput({
  onSend,
  isResponding,
  replyTarget,
  onCancelReply,
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = canSendMessage(value, isResponding) && !disabled;

  function handleSend() {
    if (!canSend) return;
    onSend(value);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleInput(event: ChangeEvent<HTMLTextAreaElement>) {
    setValue(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    textareaRef.current?.focus();
  }, [replyTarget]);

  return (
    <div className="border-t bg-background px-4 py-4">
      {replyTarget && (
        <ChatReplyPreview replyTarget={replyTarget} onCancel={onCancelReply} />
      )}

      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-muted/40 p-2",
          disabled && "opacity-60",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            replyTarget ? "Escreva sua resposta..." : "Digite sua mensagem..."
          }
          rows={1}
          disabled={disabled || isResponding}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={!canSend}
          title="Enviar"
          className="shrink-0 rounded-xl"
        >
          <ArrowUp />
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Enter para enviar · Shift+Enter para nova linha
      </p>
    </div>
  );
}
