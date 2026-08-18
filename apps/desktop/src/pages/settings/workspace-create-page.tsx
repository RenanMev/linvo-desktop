import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ImagePlus, Plus } from "lucide-react";

import {
  SettingsBack,
  SettingsError,
  SettingsHeader,
  SettingsPage,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <SettingsPage>
      <div className="space-y-5">
        <SettingsBack onClick={() => navigate("/settings/workspace")} />
        <SettingsHeader
          title="Novo workspace"
          description="Defina o nome e, se quiser, uma foto para identificar o contexto."
        />
      </div>

      {error ? <SettingsError message={error} /> : null}

      <div className="space-y-5">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-raise-2 text-muted-foreground transition-colors hover:bg-surface-hover"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Escolher foto do workspace"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="size-full object-cover" />
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
            <p className="text-[13px] text-muted-foreground">
              JPEG, PNG ou WebP · máx. 2MB
            </p>
            {imageFile ? (
              <button
                type="button"
                disabled={busy}
                className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => handleFileChange(null)}
              >
                Remover foto
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="workspace-name" className="text-sm font-medium">
            Nome
          </label>
          <Input
            id="workspace-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nome do workspace"
            className="h-11"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
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
    </SettingsPage>
  );
}
