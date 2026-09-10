import { cn } from "@/lib/utils";

type SettingsSwitchProps = {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function SettingsSwitch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: SettingsSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-muted/40 p-3">
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border border-hairline transition-colors duration-200 ease-out",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-40",
          checked ? "bg-primary" : "bg-muted-foreground/25",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-primary-foreground transition-transform duration-200 ease-out",
            checked && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}
