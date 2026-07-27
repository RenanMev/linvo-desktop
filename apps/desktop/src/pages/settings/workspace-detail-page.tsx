import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BusinessRule, WorkspaceRole } from "@linvo/shared";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  ImagePlus,
  Plus,
  ScrollText,
  Trash2,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";
import { AuthApiError } from "@/lib/auth/auth-api";
import { cn } from "@/lib/utils";
import * as workspaceApi from "@/lib/workspace/workspace-api";
import { resolveWorkspaceImageUrl } from "@/lib/workspace/workspace-api";

function workspaceInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}

function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "OWNER":
      return "Proprietário";
    case "MEMBER":
      return "Membro";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function SectionHeading({
  title,
  description,
  count,
}: {
  title: string;
  description?: string;
  count?: number;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {typeof count === "number" ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export function WorkspaceDetailPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const {
    workspaces,
    activeWorkspace,
    renameWorkspace,
    deleteWorkspace,
    selectWorkspace,
    uploadImage,
    removeImage,
  } = useWorkspace();

  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  const isActive = activeWorkspace?.id === workspace?.id;
  const isOwner = workspace?.role === "OWNER";
  const isLastWorkspace = workspaces.length <= 1;

  const [renameValue, setRenameValue] = useState(workspace?.name ?? "");
  const [confirmName, setConfirmName] = useState("");
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleContent, setRuleContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRenameValue(workspace?.name ?? "");
  }, [workspace?.name]);

  useEffect(() => {
    if (!workspace) {
      setRules([]);
      return;
    }
    void workspaceApi
      .listBusinessRules(workspace.id)
      .then(setRules)
      .catch(() => setError("Não foi possível carregar as regras"));
  }, [workspace]);

  async function handleActivate() {
    if (!workspace || isActive) return;
    setBusy(true);
    setError(null);
    try {
      await selectWorkspace(workspace.id, { navigateToChat: false });
    } catch {
      setError("Não foi possível ativar o workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!workspace || !renameValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await renameWorkspace(workspace.id, renameValue.trim());
    } catch {
      setError("Não foi possível renomear o workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadImage(file: File | null) {
    if (!workspace || !file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadImage(workspace.id, file);
    } catch {
      setError("Não foi possível atualizar a foto");
    } finally {
      setBusy(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveImage() {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      await removeImage(workspace.id);
    } catch {
      setError("Não foi possível remover a foto");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRule() {
    if (!workspace || !ruleTitle.trim() || !ruleContent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await workspaceApi.createBusinessRule(workspace.id, {
        title: ruleTitle.trim(),
        content: ruleContent.trim(),
      });
      setRules((prev) => [...prev, created]);
      setRuleTitle("");
      setRuleContent("");
    } catch {
      setError("Não foi possível criar a regra");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      await workspaceApi.deleteBusinessRule(workspace.id, ruleId);
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
    } catch {
      setError("Não foi possível remover a regra");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!workspace || !isOwner) return;
    if (confirmName !== workspace.name) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWorkspace(workspace.id, confirmName);
      navigate("/settings/workspace");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível apagar o workspace");
      }
    } finally {
      setBusy(false);
    }
  }

  const renameDirty =
    Boolean(workspace) &&
    renameValue.trim() !== (workspace?.name ?? "") &&
    renameValue.trim().length > 0;

  const canDelete =
    Boolean(workspace) &&
    isOwner &&
    !isLastWorkspace &&
    confirmName === (workspace?.name ?? "");

  const imageSrc = workspace
    ? resolveWorkspaceImageUrl(workspace.imageUrl)
    : null;

  if (!workspace) {
    return (
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 text-muted-foreground"
            onClick={() => navigate("/settings/workspace")}
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </Button>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-muted/20 px-4 py-10 text-center">
            <Building2 className="size-5 text-muted-foreground/70" />
            <p className="text-xs font-medium">Workspace não encontrado</p>
            <p className="max-w-xs text-[11px] text-muted-foreground">
              Ele pode ter sido removido ou você não tem mais acesso.
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
        <div className="space-y-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 text-muted-foreground"
            onClick={() => navigate("/settings/workspace")}
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </Button>

          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border text-sm font-bold",
                isActive
                  ? "border-primary/30 bg-primary text-primary-foreground"
                  : "border-hairline bg-muted/40 text-foreground",
              )}
            >
              {imageSrc ? (
                <img src={imageSrc} alt="" className="size-full object-cover" />
              ) : (
                workspaceInitial(workspace.name)
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {workspace.name}
                </h1>
                {isActive ? (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                    <Check className="size-2.5" />
                    Ativo
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {roleLabel(workspace.role)} · configure foto, nome e regras de
                negócio.
              </p>
            </div>
            {!isActive ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void handleActivate()}
              >
                Ativar
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : null}

        <section className="space-y-3">
          <SectionHeading
            title="Identidade"
            description="Nome e imagem usados na interface."
          />

          <div className="rounded-xl border border-hairline bg-muted/30 p-4">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) =>
                void handleUploadImage(event.target.files?.[0] ?? null)
              }
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {isOwner ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  className="shrink-0"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" />
                  {workspace.imageUrl ? "Alterar foto" : "Adicionar foto"}
                </Button>
              ) : null}
              <Input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Nome do workspace"
                className="h-8 min-w-0 flex-1 text-xs"
                aria-label="Renomear workspace"
              />
              <Button
                type="button"
                size="sm"
                disabled={busy || !renameDirty}
                className="shrink-0"
                onClick={() => void handleRename()}
              >
                Salvar
              </Button>
            </div>
            {isOwner && workspace.imageUrl ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                className="mt-2 h-7 px-2 text-[11px] text-muted-foreground"
                onClick={() => void handleRemoveImage()}
              >
                Remover foto
              </Button>
            ) : null}
          </div>
        </section>

        {isOwner ? (
          <section className="space-y-3">
            <SectionHeading
              title="Rule Review"
              description="Extraia candidatos de documentos e revise antes de promover."
            />
            <div className="rounded-xl border border-hairline bg-muted/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                  Envie documentos para o assistente sugerir novas regras. Cada
                  candidato passa por revisão antes de entrar em vigor.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() =>
                    navigate(`/settings/workspace/${workspace.id}/rule-review`)
                  }
                >
                  <ClipboardCheck className="size-3.5" />
                  Abrir Rule Review
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionHeading
            title="Procedures"
            description="Grave a tela, revise o markdown gerado e publique procedimentos."
          />
          <div className="rounded-xl border border-hairline bg-muted/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                Capture um fluxo na tela, revise o procedimento e consulte
                depois via /slug no chat.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0"
                onClick={() =>
                  navigate(`/settings/workspace/${workspace.id}/procedures`)
                }
              >
                <Video className="size-3.5" />
                Abrir Procedures
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading
            title="Regras de negócio"
            description="Instruções que o assistente deve seguir neste workspace."
            count={rules.length}
          />

          {rules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-muted/20 px-4 py-7 text-center">
              <ScrollText className="size-5 text-muted-foreground/70" />
              <p className="text-xs font-medium">Nenhuma regra cadastrada</p>
              <p className="max-w-xs text-[11px] text-muted-foreground">
                Adicione regras para orientar as respostas do assistente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-hairline bg-muted/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-neutral-deep text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-border/60">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-medium">{rule.title}</p>
                      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                        {rule.content}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Remover regra ${rule.title}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2.5 rounded-xl border border-hairline bg-muted/20 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Nova regra
            </p>
            <Input
              value={ruleTitle}
              onChange={(event) => setRuleTitle(event.target.value)}
              placeholder="Título da regra"
              className="h-8 text-xs"
            />
            <textarea
              value={ruleContent}
              onChange={(event) => setRuleContent(event.target.value)}
              placeholder="Descreva a regra de negócio..."
              rows={4}
              className={cn(
                "min-h-24 w-full resize-y rounded-lg border border-hairline bg-neutral-deep px-3 py-2 text-xs leading-relaxed shadow-xs outline-none",
                "placeholder:text-muted-foreground",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              )}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={busy || !ruleTitle.trim() || !ruleContent.trim()}
                onClick={() => void handleCreateRule()}
              >
                <Plus className="size-3.5" />
                Adicionar regra
              </Button>
            </div>
          </div>
        </section>

        {isOwner ? (
          <section className="space-y-3">
            <SectionHeading
              title="Zona de perigo"
              description="Apagar remove permanentemente dados, regras e conversas deste workspace."
            />
            <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              {isLastWorkspace ? (
                <p className="text-xs text-muted-foreground">
                  Não é possível apagar o único workspace. Crie outro antes de
                  remover este.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Digite{" "}
                    <span className="font-medium text-foreground">
                      {workspace.name}
                    </span>{" "}
                    para confirmar.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={confirmName}
                      onChange={(event) => setConfirmName(event.target.value)}
                      placeholder="Nome do workspace"
                      className="h-8 text-xs"
                      aria-label="Confirmar nome do workspace"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy || !canDelete}
                      onClick={() => void handleDeleteWorkspace()}
                    >
                      <Trash2 className="size-3.5" />
                      Apagar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
