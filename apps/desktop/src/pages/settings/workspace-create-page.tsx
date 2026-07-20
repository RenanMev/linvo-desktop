import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ImagePlus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/workspace-context";

export function WorkspaceCreatePage() {
  const navigate = useNavigate();
  const { createWorkspace } = useWorkspace();

  const [newName, setNewName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(file: File | null) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createWorkspace(newName.trim(), imageFile, {
        navigateToChat: false,
      });
      navigate(`/settings/workspace/${created.id}`);
    } catch {
      setError("Não foi possível criar o workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
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

          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">
              Novo workspace
            </h1>
            <p className="text-xs text-muted-foreground">
              Defina o nome e, se quiser, uma foto para identificar o contexto.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : null}

        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="space-y-1.5">
            <label
              htmlFor="workspace-name"
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Nome
            </label>
            <Input
              id="workspace-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nome do workspace"
              className="h-9 text-xs"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Foto
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid size-20 place-items-center overflow-hidden rounded-xl border border-dashed border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:border-border hover:bg-muted/60"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Escolher foto do workspace"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlus className="size-5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] ?? null)
                }
              />
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] text-muted-foreground">
                  JPEG, PNG ou WebP · máx. 2MB
                </p>
                {imageFile ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => handleFileChange(null)}
                  >
                    Remover foto
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => navigate("/settings/workspace")}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !newName.trim()}
            onClick={() => void handleCreate()}
          >
            <Plus className="size-3.5" />
            Criar workspace
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
