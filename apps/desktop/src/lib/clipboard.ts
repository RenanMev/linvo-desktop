import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@tauri-apps/api/core";

export async function readClipboardText(): Promise<string> {
  if (isTauri()) {
    try {
      return (await readText()) ?? "";
    } catch {
      return "";
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  }

  return "";
}

export async function writeClipboardText(text: string): Promise<boolean> {
  if (isTauri()) {
    try {
      await writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
