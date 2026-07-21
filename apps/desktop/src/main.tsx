import { useEffect, useState } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { ChecklistApp } from "@/ChecklistApp";
import { PanelApp } from "@/PanelApp";
import { AuthGate } from "@/components/auth/auth-gate";
import { WindowChromeProvider } from "@/context/window-chrome-context";
import type { WindowLabel } from "@/lib/window-close";
import "./index.css";

function resolveWindowLabel(label: string): WindowLabel {
  if (label === "panel") {
    return "panel";
  }
  if (label === "checklist") {
    return "checklist";
  }
  return "main";
}

function Bootstrap() {
  const [windowLabel, setWindowLabel] = useState<WindowLabel | null>(null);

  useEffect(() => {
    setWindowLabel(resolveWindowLabel(getCurrentWindow().label));
  }, []);

  if (!windowLabel) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (windowLabel === "checklist") {
    return (
      <WindowChromeProvider windowLabel={windowLabel}>
        <ChecklistApp />
      </WindowChromeProvider>
    );
  }

  return (
    <WindowChromeProvider windowLabel={windowLabel}>
      {windowLabel === "panel" ? <PanelApp /> : <AuthGate />}
    </WindowChromeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
