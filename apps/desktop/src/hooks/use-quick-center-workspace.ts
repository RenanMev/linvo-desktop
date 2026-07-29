import { useEffect, useState } from "react";

import { getStoredWorkspaceId } from "@/lib/workspace/workspace-store";
import * as workspaceApi from "@/lib/workspace/workspace-api";

export type QuickCenterWorkspaceState = {
  name: string | null;
  isLoading: boolean;
};

export function useQuickCenterWorkspace(
  enabled: boolean,
): QuickCenterWorkspaceState {
  const [name, setName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    setIsLoading(true);

    workspaceApi
      .listWorkspaces()
      .then((workspaces) => {
        if (!active) return;
        const activeId = getStoredWorkspaceId();
        const found = workspaces.find((workspace) => workspace.id === activeId);
        setName(found?.name ?? null);
      })
      .catch(() => {
        if (active) {
          setName(null);
        }
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
