import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Window } from "@tauri-apps/api/window";

const MAIN_LABEL = "main";

let permissionAsked = false;

export function resetNotificationPermissionAsked(): void {
  permissionAsked = false;
}

export async function notifyDesktopEvent(
  body: string,
  options?: { onlyIfHidden?: boolean },
): Promise<void> {
  const onlyIfHidden = options?.onlyIfHidden ?? true;

  try {
    if (onlyIfHidden) {
      const main = await Window.getByLabel(MAIN_LABEL);
      if (!main) {
        return;
      }
      if (await main.isVisible()) {
        return;
      }
    }

    let granted = await isPermissionGranted();

    if (!granted) {
      if (permissionAsked) {
        return;
      }
      permissionAsked = true;
      const permission = await requestPermission();
      granted = permission === "granted";
    }

    if (!granted) {
      return;
    }

    sendNotification({
      title: "Linvo Desktop",
      body,
    });
  } catch {
    return;
  }
}
