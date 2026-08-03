import type { Workspace } from "@linvo/shared";
import { Camera, Check, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveWorkspaceImageUrl } from "@/lib/workspace/workspace-api";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type WorkspaceStepProps = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  workspaceName: string;
  imagePreviewUrl: string | null;
  busy: boolean;
  error: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onWorkspaceNameChange: (value: string) => void;
  onImageChange: (file: File | null) => void;
  onContinue: () => void;
};

export function WorkspaceStep({
  workspaces,
  activeWorkspaceId,
  workspaceName,
  imagePreviewUrl,
  busy,
  error,
  onSelectWorkspace,
  onWorkspaceNameChange,
  onImageChange,
  onContinue,
}: WorkspaceStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const trimmedName = workspaceName.trim();
  const nameInvalid = !activeWorkspaceId && trimmedName.length < 2;

  function handleImage(file: File | null) {
    if (!file) {
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setFileError("Use uma imagem JPEG, PNG ou WebP");
      return;
    }
    setFileError(null);
    onImageChange(file);
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-5 space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Escolha seu workspace
        </h1>
        <p className="text-sm text-text-secondary">
          Ele reúne as regras, documentos e conversas que dão contexto ao
          assistente.
        </p>
      </div>

      <div className="scrollbar-elegant min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {workspaces.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-text-secondary">
              Workspaces existentes
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {workspaces.map((workspace) => {
                const active = activeWorkspaceId === workspace.id;
                const imageUrl = resolveWorkspaceImageUrl(workspace.imageUrl);
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectWorkspace(workspace.id)}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                      active
                        ? "border-hairline-strong bg-surface-raise-2"
                        : "border-hairline bg-surface-raise-1 hover:bg-surface-hover",
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-raise-2 font-display text-xs font-semibold">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        workspace.name.trim().slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {workspace.name}
                    </span>
                    {active ? (
                      <Check className="size-3.5 shrink-0 text-success" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="onboarding-workspace-name"
            className="text-xs font-medium text-text-secondary"
          >
            {workspaces.length > 0 ? "Ou crie um novo" : "Nome do workspace"}
          </label>
          <Input
            id="onboarding-workspace-name"
            value={workspaceName}
            autoFocus
            aria-invalid={nameInvalid}
            aria-describedby={
              nameInvalid ? "onboarding-workspace-name-error" : undefined
            }
            placeholder="Ex.: Atendimento Loja X"
            onChange={(event) => onWorkspaceNameChange(event.target.value)}
          />
          {nameInvalid ? (
            <p
              id="onboarding-workspace-name-error"
              className="text-xs text-destructive"
            >
              Informe um nome com pelo menos 2 caracteres ou escolha um
              workspace.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-raise-1 p-3">
          <button
            type="button"
            aria-label="Escolher imagem do workspace"
            onClick={() => inputRef.current?.click()}
            className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-hairline-strong bg-surface-raise-2 text-text-secondary outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Prévia da imagem do workspace"
                className="size-full object-cover"
              />
            ) : (
              <Camera className="size-4" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Arquivo de imagem do workspace"
            className="hidden"
            onChange={(event) => handleImage(event.target.files?.[0] ?? null)}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Imagem do workspace</p>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              JPEG, PNG ou WebP · opcional
            </p>
            {fileError ? (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {fileError}
              </p>
            ) : null}
          </div>
          {imagePreviewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Remover imagem"
              onClick={() => {
                setFileError(null);
                onImageChange(null);
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end border-t border-hairline pt-4">
        <Button
          type="button"
          disabled={busy || nameInvalid}
          onClick={onContinue}
        >
          {busy ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </section>
  );
}
