import type { Workspace } from "@linvo/shared";
import { Camera, Check, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  StepActions,
  StepHeader,
  StepLink,
  StepPrimary,
} from "@/components/onboarding/step-shell";
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
  onBack?: () => void;
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
  onBack,
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
      <StepHeader
        title="Escolha seu workspace"
        description="Ele reúne as regras, documentos e conversas que dão contexto ao assistente."
      />

      <div className="scrollbar-elegant -mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
        {workspaces.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[11px] text-text-tertiary">
              Workspaces existentes
            </legend>
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
                    "flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                    active
                      ? "border-accent-active/45 bg-surface-raise-2"
                      : "border-hairline bg-surface-raise-1 hover:bg-surface-hover",
                  )}
                >
                  <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-raise-2 font-display text-[11px] font-semibold">
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
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {workspace.name}
                  </span>
                  {active ? (
                    <Check className="size-3.5 shrink-0 text-success" />
                  ) : null}
                </button>
              );
            })}
          </fieldset>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="onboarding-workspace-name"
            className="block text-[11px] text-text-tertiary"
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
              className="text-[11px] text-destructive"
            >
              Informe um nome com pelo menos 2 caracteres ou escolha um
              workspace.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Escolher imagem do workspace"
            onClick={() => inputRef.current?.click()}
            className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-border-dashed bg-surface-raise-1 text-text-tertiary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
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
            <p className="text-[12px] text-text-secondary">
              Imagem do workspace · opcional
            </p>
            {fileError ? (
              <p role="alert" className="mt-0.5 text-[11px] text-destructive">
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
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>

      <StepActions
        links={
          onBack ? (
            <StepLink disabled={busy} onClick={onBack}>
              Voltar
            </StepLink>
          ) : undefined
        }
      >
        <StepPrimary disabled={busy || nameInvalid} onClick={onContinue}>
          {busy ? "Salvando..." : "Continuar"}
        </StepPrimary>
      </StepActions>
    </section>
  );
}
