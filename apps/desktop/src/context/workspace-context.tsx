import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { Workspace } from "@linvo/shared";

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
  refresh: () => Promise<void>;
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

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await workspaceApi.listWorkspaces();
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
  }, [refreshList]);

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

  const deleteWorkspace = useCallback(
    async (workspaceId: string, name: string) => {
      await workspaceApi.deleteWorkspace(workspaceId, { name });

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

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      isLoading,
      error,
      refresh,
      selectWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      uploadImage,
      removeImage,
    }),
    [
      workspaces,
      activeWorkspace,
      isLoading,
      error,
      refresh,
      selectWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
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
