use tauri::{AppHandle, Manager};

const PANEL_LABEL: &str = "panel";

#[tauri::command]
pub async fn app_quit(app: AppHandle) {
    if let Some(panel) = app.get_webview_window(PANEL_LABEL) {
        let _ = panel.hide();
    }

    app.exit(0);
}
