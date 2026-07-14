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
