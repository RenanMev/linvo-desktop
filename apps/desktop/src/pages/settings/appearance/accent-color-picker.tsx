import { useEffect, useRef, useState } from "react";
import { RgbaColorPicker, type RgbaColor } from "react-colorful";

import {
  formatRgba,
  parseRgba,
  resolveCustomAccentVars,
  type RgbaChannels,
} from "@/lib/appearance/appearance-tokens";
import { cn } from "@/lib/utils";

type AccentColorPickerProps = {
  value: string;
  onChange: (rgba: string) => void;
  className?: string;
};

const FALLBACK_COLOR: RgbaColor = { r: 124, g: 58, b: 237, a: 1 };
const COMMIT_DEBOUNCE_MS = 120;

function toPickerColor(channels: RgbaChannels): RgbaColor {
  return {
    r: channels.r,
    g: channels.g,
    b: channels.b,
    a: channels.a,
  };
}

function colorsEqual(a: RgbaColor, b: RgbaColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function previewCustomAccent(rgba: string) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const vars = resolveCustomAccentVars(rgba);
  for (const [key, next] of Object.entries(vars)) {
    root.style.setProperty(key, next);
  }
}

function ChannelInput({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const parsed = Number(draft);
          if (!Number.isFinite(parsed)) {
            setDraft(String(value));
            return;
          }
          const clamped = Math.min(max, Math.max(min, parsed));
          onCommit(clamped);
          setDraft(String(clamped));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-full rounded-md border border-hairline bg-surface-raise-2 px-2 font-technical text-xs text-foreground outline-none transition-colors focus-visible:border-hairline-strong focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </label>
  );
}

export function AccentColorPicker({
  value,
  onChange,
  className,
}: AccentColorPickerProps) {
  const parsed = parseRgba(value) ?? FALLBACK_COLOR;
  const [color, setColor] = useState<RgbaColor>(() => toPickerColor(parsed));
  const lastEmittedRef = useRef(formatRgba(toPickerColor(parsed)));
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value === lastEmittedRef.current) {
      return;
    }
    const next = parseRgba(value);
    if (!next) {
      return;
    }
    const nextColor = toPickerColor(next);
    setColor((current) => (colorsEqual(current, nextColor) ? current : nextColor));
    lastEmittedRef.current = formatRgba(nextColor);
  }, [value]);

  useEffect(
    () => () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
    },
    [],
  );

  const flushCommit = (next: RgbaColor) => {
    const rgba = formatRgba(next);
    lastEmittedRef.current = rgba;
    previewCustomAccent(rgba);
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    onChangeRef.current(rgba);
  };

  const scheduleCommit = (next: RgbaColor) => {
    const rgba = formatRgba(next);
    lastEmittedRef.current = rgba;
    previewCustomAccent(rgba);
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      onChangeRef.current(rgba);
    }, COMMIT_DEBOUNCE_MS);
  };

  const handlePickerChange = (next: RgbaColor) => {
    setColor(next);
    scheduleCommit(next);
  };

  const handlePickerChangeEnd = (next: RgbaColor) => {
    setColor(next);
    flushCommit(next);
  };

  const handleChannelCommit = (patch: Partial<RgbaColor>) => {
    const next = {
      r: Math.round(patch.r ?? color.r),
      g: Math.round(patch.g ?? color.g),
      b: Math.round(patch.b ?? color.b),
      a: patch.a ?? color.a,
    };
    setColor(next);
    flushCommit(next);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border border-hairline bg-surface-raise-1 p-2.5">
        <RgbaColorPicker
          color={color}
          onChange={handlePickerChange}
          onChangeEnd={handlePickerChangeEnd}
          className="accent-rgba-picker"
        />
      </div>

      <div className="flex items-end gap-2">
        <div
          aria-hidden
          className="mb-0.5 size-8 shrink-0 rounded-md border border-hairline"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #c0c0c0 25%, transparent 25%), linear-gradient(-45deg, #c0c0c0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #c0c0c0 75%), linear-gradient(-45deg, transparent 75%, #c0c0c0 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
          }}
        >
          <div
            className="size-full rounded-[5px]"
            style={{ backgroundColor: formatRgba(color) }}
          />
        </div>
        <ChannelInput
          label="R"
          value={color.r}
          min={0}
          max={255}
          step={1}
          onCommit={(r) => handleChannelCommit({ r })}
        />
        <ChannelInput
          label="G"
          value={color.g}
          min={0}
          max={255}
          step={1}
          onCommit={(g) => handleChannelCommit({ g })}
        />
        <ChannelInput
          label="B"
          value={color.b}
          min={0}
          max={255}
          step={1}
          onCommit={(b) => handleChannelCommit({ b })}
        />
        <ChannelInput
          label="A"
          value={Number(color.a.toFixed(2))}
          min={0}
          max={1}
          step={0.01}
          onCommit={(a) => handleChannelCommit({ a: Number(a.toFixed(3)) })}
        />
      </div>
    </div>
  );
}
