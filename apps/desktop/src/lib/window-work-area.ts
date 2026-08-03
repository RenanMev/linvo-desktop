import { invoke } from "@tauri-apps/api/core";
import { currentMonitor } from "@tauri-apps/api/window";

import type { MonitorInfo } from "@/lib/window-position";

type RustWorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function fallbackToMonitorBounds(): Promise<MonitorInfo | null> {
  const monitor = await currentMonitor();
  if (!monitor) return null;
  return {
    position: { x: monitor.position.x, y: monitor.position.y },
    size: { width: monitor.size.width, height: monitor.size.height },
  };
}

/**
 * Área útil do monitor da janela atual (exclui barra de tarefas/dock).
 * `currentMonitor()` do Tauri não expõe isso no lado JS — o comando Rust
 * `monitor_work_area` usa `Monitor::work_area()`, que o Tauri já resolve
 * de forma nativa por plataforma. Sem ele, ancorar embaixo sobrepõe a
 * barra de tarefas do Windows.
 */
export async function readWorkArea(): Promise<MonitorInfo | null> {
  try {
    const area = await invoke<RustWorkArea>("monitor_work_area");
    return {
      position: { x: area.x, y: area.y },
      size: { width: area.width, height: area.height },
    };
  } catch {
    return fallbackToMonitorBounds();
  }
}
