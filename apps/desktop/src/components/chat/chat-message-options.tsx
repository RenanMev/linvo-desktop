import { MoreHorizontal, Reply } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ChatMessageOptionsProps = {
  onReply: () => void;
  align?: "start" | "end";
  className?: string;
};

export function ChatMessageOptions({
  onReply,
  align = "end",
  className,
}: ChatMessageOptionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            "size-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100",
            className,
          )}
          title="Opções"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side="top">
        <DropdownMenuItem onClick={onReply}>
          <Reply />
          Responder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
