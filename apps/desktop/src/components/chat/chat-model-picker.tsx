import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LlmModelOption } from "@linvo/shared";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ChatModelPickerProps = {
  models: LlmModelOption[];
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
};

export function ChatModelPicker({
  models,
  value,
  onChange,
  disabled = false,
}: ChatModelPickerProps) {
  const [open, setOpen] = useState(false);
  const selected =
    models.find((model) => model.id === value) ?? models[0] ?? null;

  useEffect(() => {
    if (!selected && models[0]) {
      onChange(models[0].id);
    }
  }, [models, onChange, selected]);

  if (!selected) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          title="Selecionar modelo"
        >
          <span className="max-w-40 truncate">{selected.label}</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {models.map((model) => {
          const isSelected = model.id === selected.id;
          return (
            <DropdownMenuItem
              key={model.id}
              onSelect={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className={cn(isSelected && "bg-accent")}
            >
              <span className="flex-1 truncate">{model.label}</span>
              {isSelected ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
