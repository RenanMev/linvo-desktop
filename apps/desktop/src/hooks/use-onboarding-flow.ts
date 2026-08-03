import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Workspace } from "@linvo/shared";

import { useRuleDiscoverySession } from "@/hooks/use-rule-discovery-session";
import {
  saveOnboardingProgress,
  type OnboardingProgressData,
} from "@/lib/onboarding/onboarding-progress-store";
import {
  isStepNavigable,
  nextStepId,
  previousStepId,
  resolveStepStates,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps";
import {
  resolveOnboardingRoute,
  type OnboardingKnowledgeIntent,
} from "@/lib/onboarding/onboarding-routing";
import * as workspaceApi from "@/lib/workspace/workspace-api";
import { setStoredWorkspaceId } from "@/lib/workspace/workspace-store";

export type OnboardingRuleStatus = "draft" | "saving" | "saved" | "error";

export type OnboardingRule = {
  id: string;
  title: string;
  content: string;
  status: OnboardingRuleStatus;
};

export type OnboardingRulePreset = {
  title: string;
  content: string;
};

type UseOnboardingFlowOptions = {
  userId: string;
  onComplete: (route?: string) => Promise<void>;
};

export function useOnboardingFlow({
  userId,
  onComplete,
}: UseOnboardingFlowOptions) {
  const [stepId, setStepId] = useState<OnboardingStepId>("welcome");
  const [completedIds, setCompletedIds] = useState(
    () => new Set<OnboardingStepId>(),
  );
  const [skippedIds, setSkippedIds] = useState(
    () => new Set<OnboardingStepId>(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceNameValue, setWorkspaceNameValue] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(
    null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [rules, setRules] = useState<OnboardingRule[]>([]);
  const [knowledgeIntentValue, setKnowledgeIntentValue] =
    useState<OnboardingKnowledgeIntent>(null);
  const ruleSequenceRef = useRef(0);

  const ruleDiscovery = useRuleDiscoverySession(
    activeWorkspaceId ?? createdWorkspaceId,
    null,
    stepId === "knowledge",
  );

  const steps = useMemo(
    () =>
      resolveStepStates({
        currentStepId: stepId,
        completedIds,
        skippedIds,
      }),
    [completedIds, skippedIds, stepId],
  );

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      null,
    [activeWorkspaceId, workspaces],
  );

  const processingStepIds = useMemo(() => {
    const processing = new Set<OnboardingStepId>();
    if (
      ruleDiscovery.session?.status === "PENDING" ||
      ruleDiscovery.session?.status === "PROCESSING"
    ) {
      processing.add("knowledge");
    }
    return processing;
  }, [ruleDiscovery.session?.status]);

  useEffect(() => {
    let cancelled = false;
    void workspaceApi
      .listWorkspaces()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setWorkspaces(items);
        const preferred = items[0] ?? null;
        if (preferred) {
          setActiveWorkspaceId(preferred.id);
          setStoredWorkspaceId(preferred.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar seus workspaces");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const persist = useCallback(
    (
      targetStepId: OnboardingStepId,
      overrides: Partial<OnboardingProgressData> = {},
    ) => {
      const progress: OnboardingProgressData = {
        workspaceName: workspaceNameValue,
        activeWorkspaceId,
        createdWorkspaceId,
        rules: rules.map(({ id, title, content }) => ({
          id,
          title,
          content,
        })),
        knowledgeIntent: knowledgeIntentValue,
        ruleDiscoverySessionId: ruleDiscovery.session?.id ?? null,
        ...overrides,
        stepId: targetStepId,
      };
      saveOnboardingProgress(userId, progress);
    },
    [
      activeWorkspaceId,
      createdWorkspaceId,
      knowledgeIntentValue,
      ruleDiscovery.session?.id,
      rules,
      userId,
      workspaceNameValue,
    ],
  );

  const moveTo = useCallback(
    (
      targetStepId: OnboardingStepId,
      status?: "completed" | "skipped",
      progressOverrides?: Partial<OnboardingProgressData>,
    ) => {
      if (status === "completed") {
        setCompletedIds((current) => {
          const next = new Set(current);
          next.add(stepId);
          return next;
        });
        setSkippedIds((current) => {
          const next = new Set(current);
          next.delete(stepId);
          return next;
        });
      }
      if (status === "skipped") {
        setSkippedIds((current) => {
          const next = new Set(current);
          next.add(stepId);
          return next;
        });
        setCompletedIds((current) => {
          const next = new Set(current);
          next.delete(stepId);
          return next;
        });
      }
      setStepId(targetStepId);
      persist(targetStepId, progressOverrides);
    },
    [persist, stepId],
  );

  const goTo = useCallback(
    (targetStepId: OnboardingStepId) => {
      const target = steps.find((step) => step.id === targetStepId);
      if (target && isStepNavigable(target.status)) {
        moveTo(targetStepId);
      }
    },
    [moveTo, steps],
  );

  const next = useCallback(() => {
    const target = nextStepId(stepId);
    if (target) {
      moveTo(target, "completed");
    }
  }, [moveTo, stepId]);

  const back = useCallback(() => {
    const target = previousStepId(stepId);
    if (target) {
      moveTo(target);
    }
  }, [moveTo, stepId]);

  const skip = useCallback(() => {
    const target = nextStepId(stepId);
    if (target) {
      moveTo(target, "skipped");
    }
  }, [moveTo, stepId]);

  const setWorkspaceName = useCallback((value: string) => {
    setWorkspaceNameValue(value);
    setActiveWorkspaceId(null);
  }, []);

  const selectWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    setWorkspaceNameValue("");
    setStoredWorkspaceId(workspaceId);
  }, []);

  const replaceWorkspace = useCallback((workspace: Workspace) => {
    setWorkspaces((current) => {
      const exists = current.some((item) => item.id === workspace.id);
      return exists
        ? current.map((item) => (item.id === workspace.id ? workspace : item))
        : [...current, workspace];
    });
  }, []);

  const confirmWorkspace = useCallback(async () => {
    const name = workspaceNameValue.trim();
    const selectedExisting =
      activeWorkspaceId && activeWorkspaceId !== createdWorkspaceId
        ? workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
          null
        : null;

    if (!selectedExisting && name.length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let workspace: Workspace;
      let resolvedCreatedWorkspaceId = createdWorkspaceId;
      if (selectedExisting) {
        workspace = selectedExisting;
      } else if (createdWorkspaceId) {
        workspace = await workspaceApi.updateWorkspace(createdWorkspaceId, {
          name,
        });
      } else {
        workspace = await workspaceApi.createWorkspace({ name });
        resolvedCreatedWorkspaceId = workspace.id;
        setCreatedWorkspaceId(workspace.id);
      }

      let imageUploadFailed = false;
      if (imageFile) {
        try {
          workspace = await workspaceApi.uploadWorkspaceImage(
            workspace.id,
            imageFile,
          );
        } catch {
          imageUploadFailed = true;
        }
      }

      replaceWorkspace(workspace);
      setActiveWorkspaceId(workspace.id);
      setStoredWorkspaceId(workspace.id);
      if (imageUploadFailed) {
        setError(
          "O workspace foi criado, mas a imagem não pôde ser enviada",
        );
      }
      const target = nextStepId(stepId);
      if (target) {
        moveTo(target, "completed", {
          workspaceName: name,
          activeWorkspaceId: workspace.id,
          createdWorkspaceId: resolvedCreatedWorkspaceId,
        });
      }
    } catch {
      setError("Não foi possível configurar o workspace");
    } finally {
      setBusy(false);
    }
  }, [
    activeWorkspaceId,
    createdWorkspaceId,
    imageFile,
    moveTo,
    replaceWorkspace,
    stepId,
    workspaces,
    workspaceNameValue,
  ]);

  const addRule = useCallback((preset?: OnboardingRulePreset) => {
    ruleSequenceRef.current += 1;
    const id = `onboarding-rule-${ruleSequenceRef.current}`;
    setRules((current) => [
      ...current,
      {
        id,
        title: preset?.title ?? "",
        content: preset?.content ?? "",
        status: "draft",
      },
    ]);
  }, []);

  const updateRule = useCallback(
    (id: string, patch: Partial<Pick<OnboardingRule, "title" | "content">>) => {
      setRules((current) =>
        current.map((rule) =>
          rule.id === id
            ? { ...rule, ...patch, status: "draft" }
            : rule,
        ),
      );
    },
    [],
  );

  const removeRule = useCallback((id: string) => {
    setRules((current) => current.filter((rule) => rule.id !== id));
  }, []);

  const confirmContext = useCallback(async () => {
    const workspaceId = activeWorkspaceId ?? createdWorkspaceId;
    if (!workspaceId) {
      setError("Configure um workspace antes de adicionar contexto");
      setStepId("workspace");
      return;
    }

    const pendingRules = rules.filter(
      (rule) => rule.status !== "saved" && rule.content.trim().length > 0,
    );
    if (pendingRules.length === 0) {
      next();
      return;
    }

    setBusy(true);
    setError(null);
    const pendingIds = new Set(pendingRules.map((rule) => rule.id));
    setRules((current) =>
      current.map((rule) =>
        pendingIds.has(rule.id) ? { ...rule, status: "saving" } : rule,
      ),
    );

    const results = await Promise.allSettled(
      pendingRules.map((rule) =>
        workspaceApi.createBusinessRule(workspaceId, {
          title: rule.title.trim() || "Contexto inicial",
          content: rule.content.trim(),
        }),
      ),
    );
    const failedIds = new Set(
      results.flatMap((result, index) =>
        result.status === "rejected" ? [pendingRules[index].id] : [],
      ),
    );

    setRules((current) =>
      current.map((rule) => {
        if (!pendingIds.has(rule.id)) {
          return rule;
        }
        return {
          ...rule,
          status: failedIds.has(rule.id) ? "error" : "saved",
        };
      }),
    );
    setBusy(false);

    if (failedIds.size > 0) {
      setError(
        `${failedIds.size} ${
          failedIds.size === 1 ? "regra falhou" : "regras falharam"
        } ao salvar`,
      );
      return;
    }
    next();
  }, [activeWorkspaceId, createdWorkspaceId, next, rules]);

  const setKnowledgeIntent = useCallback(
    (intent: OnboardingKnowledgeIntent) => {
      setKnowledgeIntentValue(intent);
    },
    [],
  );

  const confirmKnowledge = useCallback(
    async (files: File[]) => {
      setKnowledgeIntentValue("rule-review");
      await ruleDiscovery.start(files);
    },
    [ruleDiscovery],
  );

  const finish = useCallback(async (routeOverride?: string) => {
    setBusy(true);
    setError(null);
    try {
      const latestSession = !routeOverride && ruleDiscovery.session?.id
        ? await ruleDiscovery.refresh()
        : null;
      const route =
        routeOverride ??
        resolveOnboardingRoute({
          workspaceId: activeWorkspaceId ?? createdWorkspaceId,
          knowledgeIntent: knowledgeIntentValue,
          candidateCount:
            latestSession?.candidates.length ??
            ruleDiscovery.session?.candidates.length ??
            0,
        });
      await onComplete(route);
    } catch {
      setError("Não foi possível finalizar o onboarding");
    } finally {
      setBusy(false);
    }
  }, [
    activeWorkspaceId,
    createdWorkspaceId,
    knowledgeIntentValue,
    onComplete,
    ruleDiscovery,
    ruleDiscovery.session?.candidates.length,
  ]);

  return {
    stepId,
    steps,
    processingStepIds,
    goTo,
    next,
    back,
    skip,
    busy,
    error,
    setError,
    workspaces,
    activeWorkspace,
    workspaceName: workspaceNameValue,
    setWorkspaceName,
    activeWorkspaceId,
    selectWorkspace,
    createdWorkspaceId,
    imageFile,
    imagePreviewUrl,
    setImageFile,
    confirmWorkspace,
    rules,
    addRule,
    updateRule,
    removeRule,
    confirmContext,
    ruleDiscovery,
    knowledgeIntent: knowledgeIntentValue,
    setKnowledgeIntent,
    confirmKnowledge,
    finish,
  };
}

export type OnboardingFlowController = ReturnType<typeof useOnboardingFlow>;
