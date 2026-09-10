import { invoke } from "@tauri-apps/api/core";

export async function rememberPreviousWindow(): Promise<void> {
  try {
    await invoke("remember_previous_window");
  } catch {
    return;
  }
}

export async function focusPreviousWindow(): Promise<boolean> {
  try {
    return Boolean(await invoke<boolean>("focus_previous_window"));
  } catch {
    return false;
  }
}
