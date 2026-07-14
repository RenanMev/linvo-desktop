import { useEffect, useState } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { PanelApp } from "@/PanelApp";
import { AuthGate } from "@/components/auth/auth-gate";
import { WindowChromeProvider } from "@/context/window-chrome-context";
import type { WindowLabel } from "@/lib/window-close";
import "./index.css";

function Bootstrap() {
  const [windowLabel, setWindowLabel] = useState<WindowLabel | null>(null);

  useEffect(() => {
    const label = getCurrentWindow().label;
    setWindowLabel(label === "panel" ? "panel" : "main");
  }, []);

  if (!windowLabel) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
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
