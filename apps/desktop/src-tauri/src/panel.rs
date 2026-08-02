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

/// Manda o DWM recortar a janela em cantos arredondados (Windows 11+).
///
/// O acrylic é pintado pelo compositor na janela nativa, que é retangular — o
/// `border-radius` do CSS arredonda só o conteúdo do webview e deixa o vidro
/// aparecendo nos quatro cantos. Sem isto, arredondar no CSS não adianta.
#[cfg(windows)]
pub fn round_window_corners(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
    };

    let Ok(handle) = window.hwnd() else {
        return;
    };

    let preference = DWMWCP_ROUND;
    // Em Windows 10 o atributo não existe e a chamada só devolve erro — daí o
    // resultado ser ignorado em vez de propagado.
    unsafe {
        DwmSetWindowAttribute(
            handle.0 as HWND,
            DWMWA_WINDOW_CORNER_PREFERENCE as u32,
            &preference as *const _ as *const core::ffi::c_void,
            core::mem::size_of_val(&preference) as u32,
        );
    }
}

#[cfg(not(windows))]
pub fn round_window_corners(_window: &tauri::WebviewWindow) {}

#[cfg(windows)]
fn apply_native_blur(window: &tauri::WebviewWindow, level: &str) -> Result<(), String> {
    use window_vibrancy::{apply_acrylic, clear_acrylic};

    let _ = clear_acrylic(window);
    round_window_corners(window);

    // `apply_blur` (blur-behind legado) é no-op no Windows 11 — todos os
    // níveis usam acrylic, variando só o tint (o SO não expõe raio de blur
    // ajustável). O `--panel-tint` do CSS (~70% opaco por padrão) fica por
    // cima da janela e dilui bastante essa diferença — os passos precisam
    // ser bem espaçados (não 0/10/60) pra sobreviver a essa diluição e o
    // usuário perceber alguma mudança entre os níveis.
    let tint: (u8, u8, u8, u8) = match level {
        "off" => return Ok(()),
        "light" => (0, 0, 0, 25),
        "strong" => (0, 0, 0, 160),
        _ => (0, 0, 0, 80),
    };
    apply_acrylic(window, Some(tint)).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn apply_native_blur(window: &tauri::WebviewWindow, level: &str) -> Result<(), String> {
    use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial};

    let _ = clear_vibrancy(window);
    let material = match level {
        "off" => return Ok(()),
        "light" => NSVisualEffectMaterial::Sidebar,
        "strong" => NSVisualEffectMaterial::UltraDark,
        _ => NSVisualEffectMaterial::HudWindow,
    };
    apply_vibrancy(window, material, None, None).map_err(|e| e.to_string())
}

#[cfg(not(any(windows, target_os = "macos")))]
fn apply_native_blur(_window: &tauri::WebviewWindow, _level: &str) -> Result<(), String> {
    Ok(())
}
