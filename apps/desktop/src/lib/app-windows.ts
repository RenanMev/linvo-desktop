import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";

import { closeChecklist } from "@/lib/checklist-window";
import { showWindowNoActivate } from "@/lib/overlay-chrome";
import { closePanel } from "@/lib/panel-window";

const MAIN_LABEL = "main";

async function getMainWindow(): Promise<Window | null> {
  return Window.getByLabel(MAIN_LABEL);
}

export type ShowMainBarOptions = {
  /**
   * Ativa a janela depois de mostrá-la. Só para quem chegou pelo teclado: sem
   * janela ativa o `Enter` não chega ao handle e o usuário fica preso na tira
   * encolhida. O padrão é `false` — tray, boot e restore pós-captura mostram a
   * ilha sem tirar o foco do canal (KAN-10).
   */
  focus?: boolean;
};

export async function showMainBar(
  options: ShowMainBarOptions = {},
): Promise<void> {
  const main = await getMainWindow();
  if (!main) {
    return;
  }
  await showWindowNoActivate();
  await main.unminimize();
  if (options.focus) {
    await main.setFocus();
  }
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

export async function isAnyWindowVisible(): Promise<boolean> {
  const main = await getMainWindow();
  const mainVisible = main ? await main.isVisible() : false;
  const panelVisible = await isPanelVisible();
  return mainVisible || panelVisible;
}

export async function toggleAppVisibility(
  options: ShowMainBarOptions = {},
): Promise<void> {
  if (await isAnyWindowVisible()) {
    await hideAllWindows();
    return;
  }
  await showMainBar(options);
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
