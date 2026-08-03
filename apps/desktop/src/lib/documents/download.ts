import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

import { fetchDocumentBytes } from "@/lib/documents/documents-api";

export type DownloadArtifactInput = {
  workspaceId: string;
  documentId: string;
  filename: string;
};

/**
 * Pergunta onde salvar, baixa o PDF autenticado e grava no destino escolhido.
 * Retorna `false` quando o usuário fecha o diálogo — cancelar não é erro.
 */
export async function downloadArtifact({
  workspaceId,
  documentId,
  filename,
}: DownloadArtifactInput): Promise<boolean> {
  const path = await save({
    defaultPath: filename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!path) {
    return false;
  }

  const bytes = await fetchDocumentBytes(workspaceId, documentId);
  await invoke("documents_save_file", { path, contents: Array.from(bytes) });
  return true;
}
