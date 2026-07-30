import { Check, MessageSquare, Sparkles } from "lucide-react";

import { useAppearance } from "@/context/appearance-context";
import type { OnboardingStepId } from "@/lib/onboarding/onboarding-steps";

type OnboardingPreviewProps = {
  stepId: OnboardingStepId;
  workspaceName: string;
  imagePreviewUrl: string | null;
};

function workspaceInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "L";
}

export function OnboardingPreview({
  stepId,
  workspaceName,
  imagePreviewUrl,
}: OnboardingPreviewProps) {
  const { preferences } = useAppearance();
  const label = workspaceName.trim() || "Seu workspace";

  if (
    stepId === "welcome" ||
    stepId === "workspace" ||
    stepId === "context" ||
    stepId === "knowledge"
  ) {
    return (
      <div
        data-testid="workspace-preview"
        className="flex h-full items-center justify-center p-6"
      >
        <div className="floating-pill flex max-w-full items-center gap-2 rounded-full border border-hairline bg-surface-raise-1 px-3 py-2 shadow-pill">
          <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-raise-2 font-display text-xs font-semibold">
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt={`Imagem de ${label}`}
                className="size-full object-cover"
              />
            ) : (
              workspaceInitial(label)
            )}
          </span>
          <span className="min-w-0">
            <span className="block max-w-52 truncate text-xs font-medium">
              {label}
            </span>
            <span className="block font-technical text-[10px] text-text-tertiary">
              contexto ativo
            </span>
          </span>
          <span className="size-1.5 shrink-0 rounded-full bg-success" />
        </div>
      </div>
    );
  }

  if (stepId === "appearance") {
    return (
      <div
        data-testid="appearance-preview"
        className="flex h-full items-center justify-center p-6"
      >
        <div className="w-full max-w-64 rounded-premium border border-hairline bg-surface-raise-1 p-4 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-display text-sm font-semibold">Linvo</p>
              <p className="font-technical text-[10px] text-text-tertiary">
                {preferences.themeMode} · {preferences.accentColor}
              </p>
            </div>
            <span className="grid size-7 place-items-center rounded-full bg-accent-active text-accent-active-foreground">
              <Sparkles className="size-3.5" />
            </span>
          </div>
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-surface-raise-2" />
            <div className="h-2 w-3/4 rounded-full bg-surface-raise-2" />
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-hairline bg-surface-hover p-2 text-xs">
              <Check className="size-3.5 text-success" />
              Preferências aplicadas
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="support-preview"
      className="flex h-full items-center justify-center p-6 text-center"
    >
      <div className="max-w-64 space-y-3">
        <span className="mx-auto grid size-10 place-items-center rounded-full border border-hairline bg-surface-raise-1">
          <MessageSquare className="size-4 text-text-secondary" />
        </span>
        <p className="font-display text-sm font-semibold">
          {stepId === "bar_tour"
            ? "A barra acompanha você"
            : "Seu primeiro resultado real"}
        </p>
        <p className="text-xs leading-relaxed text-text-secondary">
          {stepId === "bar_tour"
            ? "Use o atalho em qualquer tela e arraste o Linvo para onde preferir."
            : "Pergunte usando o contexto configurado e continue a conversa no chat."}
        </p>
      </div>
    </div>
  );
}
