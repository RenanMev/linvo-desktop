import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import type { Workspace, WorkspacePermission } from "@linvo/shared";

import { useConversations } from "@/context/chat-conversations-context";
import { clearChatLocalCache } from "@/lib/chat/chat-local-store";
import * as workspaceApi from "@/lib/workspace/workspace-api";
import {
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "@/lib/workspace/workspace-store";

type SelectWorkspaceOptions = {
  navigateToChat?: boolean;
};

type CreateWorkspaceOptions = {
  navigateToChat?: boolean;
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Permissão efetiva no workspace ativo. A resolução é feita no servidor e
   * chega pronta em `workspace.permissions` — o cliente só consulta, para a UI
   * não divergir do que a API vai de fato autorizar.
   */
  can: (permission: WorkspacePermission) => boolean;
  refresh: (options?: { includeHidden?: boolean }) => Promise<void>;
  applyRedeemedWorkspace: (workspace: Workspace) => Promise<void>;
  selectWorkspace: (
    workspaceId: string,
    options?: SelectWorkspaceOptions,
  ) => Promise<void>;
  createWorkspace: (
    name: string,
    imageFile?: File | null,
    options?: CreateWorkspaceOptions,
  ) => Promise<Workspace>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: string, name: string) => Promise<void>;
  leaveWorkspace: (workspaceId: string) => Promise<void>;
  uploadImage: (workspaceId: string, file: File) => Promise<Workspace>;
  removeImage: (workspaceId: string) => Promise<Workspace>;
};

const WorkspaceReactContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const navigate = useNavigate();
  const { refreshList } = useConversations();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => getStoredWorkspaceId(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { includeHidden?: boolean }) => {
      setError(null);
      try {
        const list = await workspaceApi.listWorkspaces(options);
        setWorkspaces(list);

        const stored = getStoredWorkspaceId();
        const preferred =
          list.find((item) => item.id === stored)?.id ?? list[0]?.id ?? null;

        if (preferred) {
          setStoredWorkspaceId(preferred);
        }
        setActiveWorkspaceId(preferred);
        if (preferred) {
          await refreshList();
        }
      } catch {
        setError("Não foi possível carregar os workspaces");
      } finally {
        setIsLoading(false);
      }
    },
    [refreshList],
  );

  const applyRedeemedWorkspace = useCallback(
    async (workspace: Workspace) => {
      setStoredWorkspaceId(workspace.id);
      setActiveWorkspaceId(workspace.id);
      try {
        const list = await workspaceApi.listWorkspaces();
        const exists = list.some((item) => item.id === workspace.id);
        setWorkspaces(
          exists
            ? list.map((item) =>
                item.id === workspace.id ? { ...item, ...workspace } : item,
              )
            : [...list, workspace],
        );
      } catch {
        setWorkspaces((prev) => {
          const exists = prev.some((item) => item.id === workspace.id);
          if (exists) {
            return prev.map((item) =>
              item.id === workspace.id ? workspace : item,
            );
          }
          return [...prev, workspace];
        });
      }
      await clearChatLocalCache();
      await refreshList();
    },
    [refreshList],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const selectWorkspace = useCallback(
    async (workspaceId: string, options?: SelectWorkspaceOptions) => {
      const navigateToChat = options?.navigateToChat ?? true;
      const activated = await workspaceApi.activateWorkspace(workspaceId);
      setStoredWorkspaceId(activated.id);
      setActiveWorkspaceId(activated.id);
      setWorkspaces((prev) =>
        prev.map((item) => (item.id === activated.id ? activated : item)),
      );
      await clearChatLocalCache();
      await refreshList();
      if (navigateToChat) {
        navigate("/chat");
      }
    },
    [navigate, refreshList],
  );

  const createWorkspace = useCallback(
    async (
      name: string,
      imageFile?: File | null,
      options?: CreateWorkspaceOptions,
    ) => {
      const navigateToChat = options?.navigateToChat ?? true;
      let created = await workspaceApi.createWorkspace({ name });
      if (imageFile) {
        created = await workspaceApi.uploadWorkspaceImage(created.id, imageFile);
      }
      setWorkspaces((prev) => [...prev, created]);
      setStoredWorkspaceId(created.id);
      setActiveWorkspaceId(created.id);
      await clearChatLocalCache();
      await refreshList();
      if (navigateToChat) {
        navigate("/chat");
      }
      return created;
    },
    [navigate, refreshList],
  );

  const renameWorkspace = useCallback(
    async (workspaceId: string, name: string) => {
      const updated = await workspaceApi.updateWorkspace(workspaceId, { name });
      setWorkspaces((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },
    [],
  );

  /**
   * Tira o workspace da lista e, se ele era o ativo, aponta a sessão para
   * outro. A ativação precisa ir ao servidor: tanto apagar quanto sair zeram o
   * `activeWorkspaceId` lá, então sem o POST o backend seguiria respondendo
   * pelo workspace antigo enquanto a tela já mostra outro — e o cache local de
   * chat continuaria com as conversas de um workspace que não é mais acessível.
   */
  const dropWorkspace = useCallback(
    async (workspaceId: string) => {
      const remaining = await new Promise<Workspace[]>((resolve) => {
        setWorkspaces((prev) => {
          const next = prev.filter((item) => item.id !== workspaceId);
          resolve(next);
          return next;
        });
      });

      if (activeWorkspaceId !== workspaceId) {
        return;
      }

      const next = remaining[0] ?? null;
      if (next) {
        const activated = await workspaceApi.activateWorkspace(next.id);
        setStoredWorkspaceId(activated.id);
        setActiveWorkspaceId(activated.id);
        setWorkspaces((prev) =>
          prev.map((item) => (item.id === activated.id ? activated : item)),
        );
      } else {
        setStoredWorkspaceId(null);
        setActiveWorkspaceId(null);
      }

      await clearChatLocalCache();
      await refreshList();
    },
    [activeWorkspaceId, refreshList],
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string, name: string) => {
      await workspaceApi.deleteWorkspace(workspaceId, { name });
      await dropWorkspace(workspaceId);
    },
    [dropWorkspace],
  );

  const leaveWorkspace = useCallback(
    async (workspaceId: string) => {
      await workspaceApi.leaveWorkspace(workspaceId);
      await dropWorkspace(workspaceId);
    },
    [dropWorkspace],
  );

  const uploadImage = useCallback(
    async (workspaceId: string, file: File) => {
      const updated = await workspaceApi.uploadWorkspaceImage(workspaceId, file);
      setWorkspaces((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },
    [],
  );

  const removeImage = useCallback(async (workspaceId: string) => {
    const updated = await workspaceApi.deleteWorkspaceImage(workspaceId);
    setWorkspaces((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    return updated;
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((item) => item.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const can = useCallback(
    (permission: WorkspacePermission) =>
      activeWorkspace?.permissions.includes(permission) ?? false,
    [activeWorkspace],
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      isLoading,
      error,
      can,
      refresh,
      applyRedeemedWorkspace,
      selectWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      leaveWorkspace,
      uploadImage,
      removeImage,
    }),
    [
      workspaces,
      activeWorkspace,
      isLoading,
      error,
      can,
      refresh,
      applyRedeemedWorkspace,
      selectWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      leaveWorkspace,
      uploadImage,
      removeImage,
    ],
  );

  return (
    <WorkspaceReactContext.Provider value={value}>
      {children}
    </WorkspaceReactContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceReactContext);
  if (!ctx) {
    throw new Error("useWorkspace deve ser usado dentro de WorkspaceProvider");
  }
  return ctx;
}
