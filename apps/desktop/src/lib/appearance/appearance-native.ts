import { invoke } from "@tauri-apps/api/core";
import type { BlurLevel } from "@linvo/shared";

/**
 * O backdrop-filter do CSS não borra o que está atrás de uma janela Tauri
 * transparente (WebView2 compõe só a página). O vidro real vem do SO:
 * este helper pede ao Rust para aplicar/limpar acrylic atrás do painel.
 * Best-effort: fora do Tauri (vitest, browser) o invoke falha e é ignorado.
 */
export async function syncPanelNativeBlur(level: BlurLevel): Promise<void> {
  try {
    await invoke("panel_set_blur", { level });
  } catch (err) {
    // Sem runtime Tauri (vitest/browser) isso é esperado; no app é sinal
    // de permissão/comando quebrado — deixar visível no devtools.
    console.warn("[appearance] panel_set_blur falhou:", err);
  }
}
