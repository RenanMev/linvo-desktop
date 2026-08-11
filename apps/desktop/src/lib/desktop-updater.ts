import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";

export async function applyDesktopUpdate(): Promise<void> {
  const update = await check();
  if (!update) {
    throw new Error("Nenhuma atualização encontrada no canal do updater");
  }

  await update.downloadAndInstall();
  await relaunch();
}

export async function openManualDownload(url: string): Promise<void> {
  await openUrl(url);
}
