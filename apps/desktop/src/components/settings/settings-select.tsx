import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SettingsSelectOption<T extends string> = {
  value: T;
  label: string;
};

type SettingsSelectProps<T extends string> = {
  label: string;
  description: string;
  value: T;
  options: ReadonlyArray<SettingsSelectOption<T>>;
  onChange: (value: T) => void;
};

export function SettingsSelect<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: SettingsSelectProps<T>) {
  const currentLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="rounded-xl border border-hairline bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  "group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-neutral-deep px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 ease-out",
                  "hover:-translate-y-px hover:border-hairline-strong hover:bg-muted/60 hover:shadow-sm active:translate-y-0 active:scale-[0.98]",
                )}
              />
            }
          >
            {currentLabel}
            <ChevronDown className="size-3 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0.5 group-data-[popup-open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-40"
          >
            {options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                selected={option.value === value}
                className={cn(
                  "relative z-10 rounded-md bg-transparent text-xs transition-[color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "data-highlighted:translate-x-0 data-highlighted:bg-transparent",
                  option.value === value
                    ? "text-foreground"
                    : "text-foreground/70 data-highlighted:text-foreground",
                )}
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
