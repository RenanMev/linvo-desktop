use tauri::{AppHandle, Emitter, Manager};

const PANEL_LABEL: &str = "panel";
const NAVIGATE_EVENT: &str = "panel://navigate";

fn panel_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(PANEL_LABEL)
        .ok_or_else(|| format!("window '{PANEL_LABEL}' not found"))
}

#[tauri::command]
pub async fn panel_open(app: AppHandle, route: String) -> Result<(), String> {
    let panel = panel_window(&app)?;

    panel.center().map_err(|e| e.to_string())?;
    panel.show().map_err(|e| e.to_string())?;
    panel.set_focus().map_err(|e| e.to_string())?;
    app.emit_to(PANEL_LABEL, NAVIGATE_EVENT, route)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn panel_close(app: AppHandle) -> Result<(), String> {
    let panel = panel_window(&app)?;
    panel.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn panel_is_open(app: AppHandle) -> Result<bool, String> {
    let panel = panel_window(&app)?;
    panel.is_visible().map_err(|e| e.to_string())
}

/// Blur nativo do SO atrás do painel. O backdrop-filter do CSS não enxerga
/// o que está atrás de uma janela transparente (limitação do WebView2), então
/// o efeito de vidro real precisa vir do compositor: acrylic via DWM.
#[tauri::command]
pub async fn panel_set_blur(app: AppHandle, level: String) -> Result<(), String> {
    let panel = panel_window(&app)?;
    let result = apply_native_blur(&panel, &level);
    if let Err(err) = &result {
        eprintln!("[panel_set_blur] level={level}: {err}");
    }
    result
}

/// Aplica o acrylic default no boot, antes de qualquer invoke do front.
pub fn init_native_blur(window: &tauri::WebviewWindow) {
    if let Err(err) = apply_native_blur(window, "medium") {
        eprintln!("[init_native_blur] {err}");
    }
}

#[cfg(windows)]
fn apply_native_blur(window: &tauri::WebviewWindow, level: &str) -> Result<(), String> {
    use window_vibrancy::{apply_acrylic, clear_acrylic};

    let _ = clear_acrylic(window);

    // `apply_blur` (blur-behind legado) é no-op no Windows 11 — todos os
    // níveis usam acrylic, variando só o tint. A translucidez visível fica
    // por conta do --panel-tint no CSS.
    let tint: (u8, u8, u8, u8) = match level {
        "off" => return Ok(()),
        "light" => (0, 0, 0, 0),
        "strong" => (0, 0, 0, 60),
        _ => (0, 0, 0, 10),
    };
    apply_acrylic(window, Some(tint)).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn apply_native_blur(window: &tauri::WebviewWindow, level: &str) -> Result<(), String> {
    use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial};

    let _ = clear_vibrancy(window);
    if level == "off" {
        return Ok(());
    }
    apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, None).map_err(|e| e.to_string())
}

#[cfg(not(any(windows, target_os = "macos")))]
fn apply_native_blur(_window: &tauri::WebviewWindow, _level: &str) -> Result<(), String> {
    Ok(())
}
