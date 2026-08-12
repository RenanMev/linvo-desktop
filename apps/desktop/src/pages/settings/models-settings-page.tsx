import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  LlmCredentialStatus,
  LlmCredentialStatusResponse,
  LlmModelOption,
} from "@linvo/shared";

import { SettingsSelect } from "@/components/settings/settings-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";
import { AuthApiError } from "@/lib/auth/auth-api";
import { fetchLlmModels } from "@/lib/chat/llm-models";
import {
  deleteUserLlmCredential,
  deleteWorkspaceLlmCredential,
  fetchUserLlmStatus,
  fetchWorkspaceLlmStatus,
  updateUserLlmModel,
  updateWorkspaceLlmModel,
  upsertUserLlmCredential,
  upsertWorkspaceLlmCredential,
} from "@/lib/llm/llm-credential-api";

type Scope = "user" | "workspace";

function sourceLabel(source: string | undefined): string {
  if (source === "user") return "sua chave";
  if (source === "workspace") return "chave do workspace";
  if (source === "platform") return "chave da plataforma";
  return "não resolvida";
}

function CredentialCard({
  title,
  description,
  status,
  models,
  canEdit,
  busy,
  error,
  onSave,
  onUpdateModel,
  onDelete,
}: {
  title: string;
  description: string;
  status: LlmCredentialStatus | null;
  models: LlmModelOption[];
  canEdit: boolean;
  busy: boolean;
  error: string | null;
  onSave: (apiKey: string, model?: string) => Promise<void>;
  onUpdateModel: (model: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const hasKey = Boolean(status?.hasApiKey);
  const modelOptions = useMemo(
    () => models.map((model) => ({ value: model.id, label: model.label })),
    [models],
  );
  const selectedModel =
    status?.model && models.some((model) => model.id === status.model)
      ? status.model
      : (models[0]?.id ?? "");

  async function handleSave() {
    setLocalError(null);
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setLocalError("Informe a API key da OpenAI.");
      return;
    }
    try {
      await onSave(trimmed, selectedModel || undefined);
      setApiKey("");
    } catch (error) {
      setLocalError(
        error instanceof AuthApiError
          ? error.message
          : "Não foi possível salvar a chave.",
      );
    }
  }

  async function handleModelChange(model: string) {
    setLocalError(null);
    try {
      await onUpdateModel(model);
    } catch (error) {
      setLocalError(
        error instanceof AuthApiError
          ? error.message
          : "Não foi possível atualizar o modelo.",
      );
    }
  }

  async function handleDelete() {
    setLocalError(null);
    try {
      await onDelete();
      setApiKey("");
    } catch (error) {
      setLocalError(
        error instanceof AuthApiError
          ? error.message
          : "Não foi possível remover a chave.",
      );
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-muted/40 p-3">
      <div className="space-y-0.5">
        <p className="text-xs font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-lg border border-hairline bg-neutral-deep/60 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        <p className="mt-0.5 text-xs font-medium">
          {hasKey
            ? `Chave configurada ${status?.keyHint ? `(${status.keyHint})` : ""}`
            : "Nenhuma chave configurada"}
        </p>
      </div>

      {canEdit ? (
        <>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              {hasKey ? "Substituir API key" : "API key OpenAI"}
            </label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="sk-..."
              value={apiKey}
              disabled={busy}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || apiKey.trim().length === 0}
              onClick={() => void handleSave()}
            >
              {hasKey ? "Atualizar chave" : "Salvar e validar"}
            </Button>
            {hasKey ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void handleDelete()}
              >
                Remover chave
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Você pode ver o status, mas só quem tem permissão de editar o
          workspace altera esta chave.
        </p>
      )}

      {hasKey && canEdit && modelOptions.length > 0 ? (
        <SettingsSelect
          label="Modelo padrão"
          description="Usado quando nenhuma seleção for feita no chat."
          value={selectedModel}
          options={modelOptions}
          onChange={(value) => void handleModelChange(value)}
        />
      ) : null}

      {!hasKey ? (
        <p className="text-[11px] text-muted-foreground">
          O modelo só pode ser escolhido depois de configurar uma chave própria.
        </p>
      ) : null}

      {(localError || error) && (
        <p className="text-[11px] text-destructive">{localError ?? error}</p>
      )}
    </div>
  );
}

export function ModelsSettingsPage() {
  const { activeWorkspace, can } = useWorkspace();
  const [models, setModels] = useState<LlmModelOption[]>([]);
  const [userStatus, setUserStatus] =
    useState<LlmCredentialStatusResponse | null>(null);
  const [workspaceStatus, setWorkspaceStatus] =
    useState<LlmCredentialStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyScope, setBusyScope] = useState<Scope | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const canEditWorkspace = can("workspace:update");

  const refresh = useCallback(async () => {
    setPageError(null);
    setLoading(true);
    try {
      const [catalog, user] = await Promise.all([
        fetchLlmModels(),
        fetchUserLlmStatus(),
      ]);
      setModels(catalog.models);
      setUserStatus(user);

      if (activeWorkspace?.id) {
        const workspace = await fetchWorkspaceLlmStatus(activeWorkspace.id);
        setWorkspaceStatus(workspace);
      } else {
        setWorkspaceStatus(null);
      }
    } catch (error) {
      setPageError(
        error instanceof AuthApiError
          ? error.message
          : "Não foi possível carregar as configurações de modelo.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const effective =
    userStatus?.effective ?? workspaceStatus?.effective ?? undefined;
  const modelSelectionEnabled = Boolean(effective?.modelSelectionEnabled);

  async function withBusy(scope: Scope, action: () => Promise<void>) {
    setBusyScope(scope);
    try {
      await action();
      await refresh();
    } finally {
      setBusyScope(null);
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Modelos</h1>
          <p className="text-xs text-muted-foreground">
            Configure a chave OpenAI e o modelo. A seleção de modelo no chat só
            fica disponível com chave própria.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-hairline bg-muted/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Em uso agora
          </p>
          <p className="mt-0.5 text-xs font-medium">
            {loading
              ? "Carregando…"
              : `${sourceLabel(effective?.source)}${
                  effective?.model ? ` · ${effective.model}` : ""
                }`}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Precedência: sua chave → workspace → plataforma.
            {modelSelectionEnabled
              ? " Seleção de modelo liberada."
              : " Sem BYO key, o chat usa o modelo padrão da plataforma."}
          </p>
        </div>

        {pageError ? (
          <p className="mt-3 text-[11px] text-destructive">{pageError}</p>
        ) : null}

        <div className="mt-6 space-y-3">
          <CredentialCard
            title="Sua chave"
            description="Usada em qualquer workspace enquanto estiver configurada."
            status={userStatus?.credential ?? null}
            models={models}
            canEdit
            busy={busyScope === "user" || loading}
            error={null}
            onSave={async (apiKey, model) => {
              await withBusy("user", async () => {
                await upsertUserLlmCredential({ apiKey, model });
              });
            }}
            onUpdateModel={async (model) => {
              await withBusy("user", async () => {
                await updateUserLlmModel({ model });
              });
            }}
            onDelete={async () => {
              await withBusy("user", async () => {
                await deleteUserLlmCredential();
              });
            }}
          />

          {activeWorkspace ? (
            <CredentialCard
              title={`Workspace · ${activeWorkspace.name}`}
              description="Usada por membros sem chave própria neste workspace."
              status={workspaceStatus?.credential ?? null}
              models={models}
              canEdit={canEditWorkspace}
              busy={busyScope === "workspace" || loading}
              error={null}
              onSave={async (apiKey, model) => {
                await withBusy("workspace", async () => {
                  await upsertWorkspaceLlmCredential(activeWorkspace.id, {
                    apiKey,
                    model,
                  });
                });
              }}
              onUpdateModel={async (model) => {
                await withBusy("workspace", async () => {
                  await updateWorkspaceLlmModel(activeWorkspace.id, { model });
                });
              }}
              onDelete={async () => {
                await withBusy("workspace", async () => {
                  await deleteWorkspaceLlmCredential(activeWorkspace.id);
                });
              }}
            />
          ) : (
            <div className="rounded-xl border border-hairline bg-muted/40 p-3">
              <p className="text-xs font-medium">Workspace</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Selecione um workspace ativo para configurar a chave compartilhada.
              </p>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
