import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatArtifact } from "@/lib/chat/types";
import { downloadArtifact } from "@/lib/documents/download";
import { formatBytes } from "@/lib/documents/format-bytes";
import { useWorkspace } from "@/context/workspace-context";

type ChatArtifactCardProps = {
  artifact: ChatArtifact;
};

type DownloadState = "idle" | "downloading" | "error";

export function ChatArtifactCard({ artifact }: ChatArtifactCardProps) {
  const { activeWorkspace } = useWorkspace();
  const [state, setState] = useState<DownloadState>("idle");

  const isDownloading = state === "downloading";
  const workspaceId = activeWorkspace?.id;

  async function handleDownload() {
    if (!workspaceId) {
      setState("error");
      return;
    }

    setState("downloading");
    try {
      await downloadArtifact({
        workspaceId,
        documentId: artifact.id,
        filename: artifact.filename,
      });
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const details = [
    formatBytes(artifact.sizeBytes),
    artifact.pageCount
      ? `${artifact.pageCount} ${artifact.pageCount === 1 ? "página" : "páginas"}`
      : null,
  ].filter(Boolean);

  return (
    <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-hairline bg-neutral-raised px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-popover text-text-tertiary">
        <FileText className="size-4" aria-hidden />
      </span>

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {artifact.title}
        </span>
        <span className="font-technical text-xs text-muted-foreground">
          {details.join(" · ")}
        </span>
        {state === "error" ? (
          <span className="text-xs text-destructive">
            Não foi possível baixar. Tente de novo.
          </span>
        ) : null}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="ml-auto shrink-0 gap-1.5"
        disabled={isDownloading}
        aria-label={`Baixar ${artifact.filename}`}
        onClick={handleDownload}
      >
        {isDownloading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Download className="size-3.5" aria-hidden />
        )}
        {state === "error" ? "Tentar de novo" : "Baixar"}
      </Button>
    </div>
  );
}
