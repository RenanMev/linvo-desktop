import { useEffect, useState } from "react";

import {
  getCachedWorkspaceName,
  getStoredWorkspaceId,
  setCachedWorkspaceName,
} from "@/lib/workspace/workspace-store";
import * as workspaceApi from "@/lib/workspace/workspace-api";

export type QuickCenterWorkspaceState = {
  name: string | null;
  isLoading: boolean;
};

/**
 * Nome do workspace ativo, com hidratação síncrona a partir do cache.
 *
 * O nome vem do cache já no primeiro render e a rede só revalida. É o que faz
 * o painel do quick center nascer com o nome escrito: ele é revelado durante o
 * morph de abertura, e uma resposta de rede — por mais cedo que seja pedida —
 * chega alguns quadros depois, trocando o texto no meio da animação.
 *
 * `isLoading` só é verdadeiro quando não há nada em cache para mostrar. Com
 * cache a revalidação é silenciosa: piscar um estado de carregamento por cima
 * de um nome que já está correto é pior que não indicar nada.
 */
export function useQuickCenterWorkspace(
  enabled: boolean,
): QuickCenterWorkspaceState {
  const [name, setName] = useState<string | null>(() =>
    getCachedWorkspaceName(getStoredWorkspaceId()),
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    // Só indica carregamento quando não há nome nenhum na tela.
    setIsLoading(getCachedWorkspaceName(getStoredWorkspaceId()) === null);

    workspaceApi
      .listWorkspaces()
      .then((workspaces) => {
        if (!active) return;
        const activeId = getStoredWorkspaceId();
        const found = workspaces.find((workspace) => workspace.id === activeId);
        const resolved = found?.name ?? null;
        setName(resolved);
        setCachedWorkspaceName(activeId, resolved);
      })
      .catch(() => {
        /*
         * Mantém o que está na tela. O cache é a última resposta boa do
         * servidor; apagá-lo por uma falha de rede transformaria uma queda
         * momentânea de conexão em nome sumindo do painel.
         */
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return { name, isLoading };
}
