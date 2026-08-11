import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";

const ALLOWED_DOWNLOAD_HOSTS = new Set(["github.com", "www.github.com"]);
const ALLOWED_DOWNLOAD_PATH_PREFIX = "/RenanMev/linvo-desktop/";

export function isAllowedManualDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    if (!ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname)) {
      return false;
    }
    return parsed.pathname.startsWith(ALLOWED_DOWNLOAD_PATH_PREFIX);
  } catch {
    return false;
  }
}

export async function applyDesktopUpdate(): Promise<void> {
  const update = await check();
  if (!update) {
    throw new Error("Nenhuma atualização encontrada no canal do updater");
  }

  await update.downloadAndInstall();
  await relaunch();
}

export async function openManualDownload(url: string): Promise<void> {
  if (!isAllowedManualDownloadUrl(url)) {
    throw new Error("URL de download não permitida");
  }
  await openUrl(url);
}
