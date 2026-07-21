import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";

import { closeChecklist } from "@/lib/checklist-window";
import { closePanel } from "@/lib/panel-window";

const MAIN_LABEL = "main";

async function getMainWindow(): Promise<Window | null> {
  return Window.getByLabel(MAIN_LABEL);
}

export async function showMainBar(): Promise<void> {
  const main = await getMainWindow();
  if (!main) {
    return;
  }
  await main.show();
  await main.unminimize();
  await main.setFocus();
}

export async function hideMainBar(): Promise<void> {
  const main = await getMainWindow();
  if (!main) {
    return;
  }
  await main.hide();
}

export async function hideAllWindows(): Promise<void> {
  await hideMainBar();
  await closePanel();
  await closeChecklist();
}

export async function isPanelVisible(): Promise<boolean> {
  try {
    return await invoke<boolean>("panel_is_open");
  } catch {
    return false;
  }
}

export async function isChecklistVisible(): Promise<boolean> {
  try {
    return await invoke<boolean>("checklist_is_open");
  } catch {
    return false;
  }
}

export async function isAnyWindowVisible(): Promise<boolean> {
  const main = await getMainWindow();
  const mainVisible = main ? await main.isVisible() : false;
  const panelVisible = await isPanelVisible();
  const checklistVisible = await isChecklistVisible();
  return mainVisible || panelVisible || checklistVisible;
}

export async function toggleAppVisibility(): Promise<void> {
  if (await isAnyWindowVisible()) {
    await hideAllWindows();
    return;
  }
  await showMainBar();
}

export async function updateTaskbarVisibility(compact: boolean): Promise<void> {
  const main = await getMainWindow();
  if (!main) {
    return;
  }
  await main.setSkipTaskbar(compact);
}

export async function quitApp(): Promise<void> {
  await invoke("app_quit");
}

export async function hideCurrentWindow(): Promise<void> {
  await getCurrentWindow().hide();
}
