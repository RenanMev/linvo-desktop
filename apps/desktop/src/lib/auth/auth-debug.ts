import { getCurrentWindow } from "@tauri-apps/api/window";

let cachedWindowLabel: string | null = null;

async function resolveWindowLabel(): Promise<string> {
  if (cachedWindowLabel) {
    return cachedWindowLabel;
  }

  try {
    cachedWindowLabel = getCurrentWindow().label;
  } catch {
    cachedWindowLabel = "unknown";
  }

  return cachedWindowLabel;
}

export function authDebug(
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) {
    return;
  }

  void (async () => {
    const window = await resolveWindowLabel();
    console.info("[auth]", {
      ts: new Date().toISOString(),
      window,
      event,
      ...data,
    });
  })();
}
