use tauri::AppHandle;
use tauri::Manager;

const CHECKLIST_LABEL: &str = "checklist";

fn checklist_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(CHECKLIST_LABEL)
        .ok_or_else(|| format!("window '{CHECKLIST_LABEL}' not found"))
}

#[tauri::command]
pub async fn checklist_open(app: AppHandle) -> Result<(), String> {
    let checklist = checklist_window(&app)?;

    checklist.show().map_err(|e| e.to_string())?;
    checklist.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn checklist_close(app: AppHandle) -> Result<(), String> {
    let checklist = checklist_window(&app)?;
    checklist.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn checklist_is_open(app: AppHandle) -> Result<bool, String> {
    let checklist = checklist_window(&app)?;
    checklist.is_visible().map_err(|e| e.to_string())
}
