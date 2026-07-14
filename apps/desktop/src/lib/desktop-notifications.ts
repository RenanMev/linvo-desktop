import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function notifyDesktopEvent(body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted();

    if (!granted) {
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
