import type { KeyboardEvent } from "react";
import type { UserPublic } from "@linvo/shared";

import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { OnboardingTitlebar } from "@/components/onboarding/onboarding-titlebar";
import { AppearanceStep } from "@/components/onboarding/steps/appearance-step";
import { BarTourStep } from "@/components/onboarding/steps/bar-tour-step";
import { ContextStep } from "@/components/onboarding/steps/context-step";
import { FirstQuestionStep } from "@/components/onboarding/steps/first-question-step";
import { KnowledgeStep } from "@/components/onboarding/steps/knowledge-step";
import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";
import { WorkspaceStep } from "@/components/onboarding/steps/workspace-step";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { isOnboardingForced } from "@/lib/onboarding/onboarding-store";

type OnboardingShellProps = {
  user: UserPublic;
  onComplete: (route?: string) => Promise<void>;
};

export function OnboardingShell({
  user,
  onComplete,
}: OnboardingShellProps) {
  const flow = useOnboardingFlow({ userId: user.id, onComplete });
  const workspaceLabel =
    flow.activeWorkspace?.name || flow.workspaceName || "Seu workspace";
  const workspaceCanContinue =
    Boolean(flow.activeWorkspaceId) || flow.workspaceName.trim().length >= 2;
  const canGoBack = flow.stepId !== "welcome";
  const onBack = canGoBack ? flow.back : undefined;

  function runPrimaryAction() {
    if (flow.busy) {
      return;
    }
    switch (flow.stepId) {
      case "welcome":
        flow.next();
        return;
      case "workspace":
        if (workspaceCanContinue) {
          void flow.confirmWorkspace();
        }
        return;
      case "context":
        void flow.confirmContext();
        return;
      case "knowledge":
      case "appearance":
      case "bar_tour":
        flow.next();
        return;
      case "first_question":
        void flow.finish();
        return;
      default: {
        const _exhaustive: never = flow.stepId;
        return _exhaustive;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== "Enter") {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLButtonElement ||
      target instanceof HTMLAnchorElement
    ) {
      return;
    }

    event.preventDefault();
    runPrimaryAction();
  }

  return (
    <div
      data-testid="onboarding-shell"
      onKeyDown={handleKeyDown}
      aria-busy={flow.busy}
      className="window-shell flex h-full w-full flex-col overflow-hidden rounded-premium bg-neutral-deep text-foreground"
    >
      {/*
       * Uma etapa por tela: coluna única e centrada, com o progresso no topo.
       * A barra de janela é a última no DOM (e a primeira na tela via `order`)
       * para que o Tab comece no conteúdo, não nos botões da janela.
       */}
      <div className="order-2 flex min-h-0 flex-1 flex-col items-center px-8 pt-3 pb-8">
        <OnboardingProgress
          steps={flow.steps}
          currentStepId={flow.stepId}
          forced={isOnboardingForced()}
        />

        <div className="mt-8 flex min-h-0 w-full max-w-[29rem] flex-1 flex-col">
          {flow.stepId === "welcome" ? (
            <WelcomeStep busy={flow.busy} onContinue={flow.next} />
          ) : null}
          {flow.stepId === "workspace" ? (
            <WorkspaceStep
              workspaces={flow.workspaces}
              activeWorkspaceId={flow.activeWorkspaceId}
              workspaceName={flow.workspaceName}
              imagePreviewUrl={flow.imagePreviewUrl}
              busy={flow.busy}
              error={flow.error}
              onSelectWorkspace={flow.selectWorkspace}
              onWorkspaceNameChange={flow.setWorkspaceName}
              onImageChange={flow.setImageFile}
              onContinue={() => void flow.confirmWorkspace()}
              onBack={onBack}
            />
          ) : null}
          {flow.stepId === "context" ? (
            <ContextStep
              rules={flow.rules}
              busy={flow.busy}
              error={flow.error}
              onAddRule={flow.addRule}
              onUpdateRule={flow.updateRule}
              onRemoveRule={flow.removeRule}
              onConfirm={() => void flow.confirmContext()}
              onSkip={flow.skip}
              onBack={onBack}
            />
          ) : null}
          {flow.stepId === "knowledge" ? (
            <KnowledgeStep
              session={flow.ruleDiscovery.session}
              isPolling={flow.ruleDiscovery.isPolling}
              busy={flow.busy}
              error={flow.ruleDiscovery.error}
              knowledgeIntent={flow.knowledgeIntent}
              onConfirmFiles={flow.confirmKnowledge}
              onSelectProcedures={() => flow.setKnowledgeIntent("procedures")}
              onContinue={flow.next}
              onSkip={() => {
                flow.setKnowledgeIntent(null);
                flow.skip();
              }}
              onBack={onBack}
            />
          ) : null}
          {flow.stepId === "appearance" ? (
            <AppearanceStep
              busy={flow.busy}
              onContinue={flow.next}
              onBack={onBack}
            />
          ) : null}
          {flow.stepId === "bar_tour" ? (
            <BarTourStep
              busy={flow.busy}
              onContinue={flow.next}
              onBack={onBack}
            />
          ) : null}
          {flow.stepId === "first_question" ? (
            <FirstQuestionStep
              workspaceName={workspaceLabel}
              busy={flow.busy}
              finish={flow.finish}
              onBack={onBack}
            />
          ) : null}
        </div>
      </div>

      <div className="order-1 shrink-0">
        <OnboardingTitlebar user={user} />
      </div>
    </div>
  );
}
