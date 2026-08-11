import { Download, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DesktopUpdateState } from "@/hooks/use-desktop-update";

type DesktopUpdateBannerProps = {
  update: DesktopUpdateState;
};

export function DesktopUpdateBanner({ update }: DesktopUpdateBannerProps) {
  const softVisible =
    !update.blocking &&
    (update.status === "available" ||
      update.status === "updating" ||
      update.status === "error");

  if (!softVisible) {
    return null;
  }

  const { release, applyUpdate, dismiss, openDownload, error, status } = update;
  const updating = status === "updating";
  const checkFailed = status === "error" && !release;

  return (
    <div className="flex items-start gap-3 border-b border-hairline bg-surface-raise-1 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {checkFailed
            ? "Não foi possível verificar atualizações"
            : `Nova versão ${release?.latestVersion ?? ""} disponível`}
        </p>
        {release?.releaseNotes ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {release.releaseNotes}
          </p>
        ) : null}
        {error ? (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {release ? (
          <Button
            type="button"
            size="sm"
            disabled={updating}
            onClick={() => void applyUpdate()}
          >
            {updating ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {updating ? "Atualizando..." : "Atualizar"}
          </Button>
        ) : null}
        {error && release ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={updating}
            onClick={() => void openDownload()}
          >
            Baixar
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Depois"
          disabled={updating}
          onClick={dismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

type DesktopUpdateMandatoryModalProps = {
  update: DesktopUpdateState;
};

export function DesktopUpdateMandatoryModal({
  update,
}: DesktopUpdateMandatoryModalProps) {
  const visible =
    update.blocking &&
    (update.status === "mandatory" || update.status === "updating") &&
    update.release;

  if (!visible || !update.release) {
    return null;
  }

  const { release, applyUpdate, openDownload, error, status } = update;
  const updating = status === "updating";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-deep/80 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-card p-5 shadow-lg">
        <h2 className="text-base font-semibold tracking-tight">
          Atualização obrigatória
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua versão precisa ser atualizada para {release.latestVersion} para
          continuar usando o Linvo.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {release.releaseNotes}
        </p>
        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={updating}
            onClick={() => void applyUpdate()}
          >
            {updating ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {updating ? "Atualizando..." : "Atualizar agora"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={updating}
            onClick={() => void openDownload()}
          >
            Baixar manualmente
          </Button>
        </div>
      </div>
    </div>
  );
}
