import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]["value"];

function languageLabel(value: LanguageValue): string {
  return LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

type SettingsSelectProps = {
  label: string;
  description: string;
  value: LanguageValue;
  onChange: (value: LanguageValue) => void;
};

function SettingsSelect({
  label,
  description,
  value,
  onChange,
}: SettingsSelectProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                "hover:bg-muted/60",
              )}
            >
              {languageLabel(value)}
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {LANGUAGE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className="text-xs"
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function GeneralSettingsPage() {
  const [systemLanguage, setSystemLanguage] = useState<LanguageValue>("pt-BR");
  const [responseLanguage, setResponseLanguage] =
    useState<LanguageValue>("pt-BR");

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Geral</h1>
          <p className="text-xs text-muted-foreground">
            Preferências gerais do assistente.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <SettingsSelect
            label="Idioma do sistema"
            description="Define o idioma da interface do Linvo."
            value={systemLanguage}
            onChange={setSystemLanguage}
          />
          <SettingsSelect
            label="Idioma padrão de resposta"
            description="Idioma preferido para as respostas do assistente."
            value={responseLanguage}
            onChange={setResponseLanguage}
          />
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="text-xs font-medium">Aparência</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              O tema segue a preferência do sistema operacional.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="text-xs font-medium">Atalho global</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Use Ctrl+Shift+L para mostrar ou ocultar a barra flutuante.
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
