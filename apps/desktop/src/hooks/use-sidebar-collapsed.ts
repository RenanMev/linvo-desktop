import { useCallback, useEffect, useState } from "react";

const SIDEBAR_COLLAPSED_KEY = "linvo.panel.sidebar-collapsed";

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Estado de recolhimento da sidebar. Vive no shell porque o botão que o
 * alterna fica na titlebar, fora da sidebar que ele controla.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      return;
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);

  return { collapsed, toggleCollapsed };
}
