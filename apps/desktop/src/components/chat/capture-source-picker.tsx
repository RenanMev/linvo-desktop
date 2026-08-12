import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader2, Monitor, Search, AppWindow } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  listCaptureSources,
  type CaptureSource,
  type CaptureSourceKind,
} from "@/lib/context-capture/capture-sources";
import { cn } from "@/lib/utils";

type CaptureSourcePickerProps = {
  open: boolean;
  busy?: boolean;
  onSelect: (source: CaptureSource) => void;
  onCancel: () => void;
  onFallback?: () => void;
};

type Tab = CaptureSourceKind | "all";

export function CaptureSourcePicker({
  open,
  busy = false,
  onSelect,
  onCancel,
  onFallback,
}: CaptureSourcePickerProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listCaptureSources("all");
      setSources(next);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível listar as fontes",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void load();
  }, [load, open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sources.filter((source) => {
      if (tab !== "all" && source.kind !== tab) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        source.title.toLowerCase().includes(needle) ||
        source.appName.toLowerCase().includes(needle)
      );
    });
  }, [query, sources, tab]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Selecionar fonte de captura"
        className="surface-premium flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-premium p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Selecionar contexto visual
            </p>
            <p className="font-technical text-[11px] tracking-wide text-muted-foreground">
              Escolha uma janela ou tela para anexar
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "Todas"],
              ["window", "Janelas"],
              ["monitor", "Telas"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={tab === value ? "default" : "ghost"}
              disabled={busy || loading}
              onClick={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              disabled={busy || loading}
              className="h-8 w-full rounded-md border border-hairline bg-surface-raise-2 pr-2 pl-7 text-sm outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-hairline bg-surface-raise-2 p-2">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando fontes…
            </div>
          ) : error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm">
              <p className="text-destructive">{error}</p>
              {onFallback ? (
                <Button type="button" size="sm" onClick={onFallback}>
                  Usar seletor do sistema
                </Button>
              ) : null}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Nenhuma fonte encontrada
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filtered.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(source)}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border border-hairline bg-background/40 p-2 text-left transition-colors",
                    "hover:border-primary/40 hover:bg-surface-hover",
                    busy && "opacity-60",
                  )}
                >
                  <div className="relative aspect-video overflow-hidden rounded-md bg-black/40">
                    <img
                      src={source.thumbnail}
                      alt=""
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-xs font-medium">
                      {source.kind === "monitor" ? (
                        <Monitor className="size-3 shrink-0" />
                      ) : (
                        <AppWindow className="size-3 shrink-0" />
                      )}
                      <span className="truncate">{source.title}</span>
                    </p>
                    <p className="truncate font-technical text-[10px] text-muted-foreground">
                      {source.appName || `${source.width}×${source.height}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
