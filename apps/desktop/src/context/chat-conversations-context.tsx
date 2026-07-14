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
import type { Conversation } from "@linvo/shared";

import { AuthApiError } from "@/lib/auth/auth-api";
import { PANEL_SESSION_UNAVAILABLE_MESSAGE } from "@/hooks/use-panel-session";
import * as chatApi from "@/lib/chat/chat-api";
import {
  hydrateChatLocalStore,
  loadCachedConversations,
  saveCachedConversations,
} from "@/lib/chat/chat-local-store";

function formatConversationsError(error: unknown): string {
  if (error instanceof AuthApiError && error.status === 401) {
    return PANEL_SESSION_UNAVAILABLE_MESSAGE;
  }
  return "Não foi possível carregar as conversas";
}

type ConversationsContextValue = {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  error: string | null;
  createConversation: () => Promise<Conversation>;
  selectConversation: (id: string) => void;
  syncActiveId: (id: string | null) => void;
  refreshList: () => Promise<void>;
  updateConversationTitle: (id: string, title: string) => void;
};

const ConversationsContext = createContext<ConversationsContextValue | null>(
  null,
);

export function ChatConversationsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadCachedConversations(),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyConversations = useCallback((list: Conversation[]) => {
    setConversations(list);
    saveCachedConversations(list);
  }, []);

  const refreshList = useCallback(async () => {
    setError(null);
    try {
      const list = await chatApi.listConversations();
      applyConversations(list);
    } catch (caught) {
      setConversations((current) => {
        if (current.length > 0) {
          setError(null);
          return current;
        }
        setError(formatConversationsError(caught));
        return current;
      });
    }
  }, [applyConversations]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      await hydrateChatLocalStore();

      if (cancelled) {
        return;
      }

      const cached = loadCachedConversations();
      if (cached.length > 0) {
        setConversations(cached);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      try {
        await refreshList();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshList, enabled]);

  const createConversation = useCallback(async () => {
    setError(null);
    try {
      const conversation = await chatApi.createConversation();
      setConversations((prev) => {
        const next = [conversation, ...prev];
        saveCachedConversations(next);
        return next;
      });
      setActiveId(conversation.id);
      navigate(`/chat/${conversation.id}`);
      return conversation;
    } catch (caught) {
      setError(formatConversationsError(caught));
      throw caught;
    }
  }, [navigate]);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      navigate(`/chat/${id}`);
    },
    [navigate],
  );

  const syncActiveId = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) => {
      const next = prev.map((conversation) =>
        conversation.id === id ? { ...conversation, title } : conversation,
      );
      saveCachedConversations(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      activeId,
      isLoading,
      error,
      createConversation,
      selectConversation,
      syncActiveId,
      refreshList,
      updateConversationTitle,
    }),
    [
      conversations,
      activeId,
      isLoading,
      error,
      createConversation,
      selectConversation,
      syncActiveId,
      refreshList,
      updateConversationTitle,
    ],
  );

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error("useConversations deve ser usado dentro de ChatConversationsProvider");
  }
  return context;
}

export function useSetActiveConversation() {
  const { selectConversation } = useConversations();

  return useCallback(
    (id: string | null) => {
      if (id) selectConversation(id);
    },
    [selectConversation],
  );
}
