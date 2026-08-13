/*!
 * Duas flags do Windows que resolvem, na raiz, dois problemas que antes eram
 * combatidos com `sleep`:
 *
 * - `WDA_EXCLUDEFROMCAPTURE` tira a janela do que as APIs de captura enxergam.
 *   O DWM compõe duas superfícies separadas — a que vai para o monitor e a que
 *   BitBlt/DXGI Duplication/WGC leem — e simplesmente não desenha a janela na
 *   segunda. Como o `xcap` usa o caminho GDI (`BitBlt` + `GetDIBits`), isso vale
 *   para ele. É o que permite capturar sem esperar o compositor: mesmo que a
 *   janela ainda esteja na tela, ela já não está no quadro capturado.
 *
 * - `DWMWA_TRANSITIONS_FORCEDISABLED` desliga o fade que o Windows aplica em
 *   `show()`/`hide()`. Sem isso o overlay aparece e some com uma transição de
 *   ~150 ms que o usuário lê como lentidão.
 *
 * `WDA_EXCLUDEFROMCAPTURE` exige Windows 10 2004 (build 19041). Em versões
 * anteriores `SetWindowDisplayAffinity` se comporta como `WDA_MONITOR`, que
 * deixaria a janela **preta** na captura em vez de invisível — pior que o
 * fantasma. Por isso o retorno é checado e propagado: quem chama decide se dá
 * para pular a espera pelo compositor.
 */

use std::sync::OnceLock;

/// `false` quando o SO não suporta a exclusão — aí a captura ainda precisa
/// esperar o compositor parar de desenhar as nossas janelas.
static EXCLUSION_WORKS: OnceLock<bool> = OnceLock::new();

pub fn exclusion_supported() -> bool {
    *EXCLUSION_WORKS.get().unwrap_or(&false)
}

/// Prepara as janelas no boot e descobre se a exclusão funciona neste SO.
///
/// O overlay fica excluído **para sempre** — ele só existe durante a captura e
/// não pode sair dentro dela em hipótese alguma. As outras janelas são excluídas
/// só enquanto a sessão de captura dura: deixar a flag ligada faria o Linvo
/// sumir também de compartilhamentos de tela em reunião, que é uma mudança de
/// comportamento fora do escopo da captura.
pub fn init(app: &tauri::AppHandle, overlay_label: &str) {
    use tauri::Manager;

    let mut supported = true;
    for (label, window) in app.webview_windows() {
        disable_window_transitions(&window);
        // Testa a flag em todas e devolve as não-overlay ao normal: o retorno é
        // a única forma de saber se o SO suporta `WDA_EXCLUDEFROMCAPTURE`.
        supported &= set_excluded_from_capture(&window, true);
        if label != overlay_label {
            set_excluded_from_capture(&window, false);
        }
    }
    let _ = EXCLUSION_WORKS.set(supported);
    if !supported {
        // Sem a exclusão o recorte volta a depender de esperar o compositor.
        // Vale saber disso pelo log em vez de descobrir por um fantasma no print.
        eprintln!(
            "[capture] WDA_EXCLUDEFROMCAPTURE indisponível; usando espera pelo compositor",
        );
    }
}

/// `true` quando a janela ficou de fato fora das capturas.
#[cfg(windows)]
pub fn set_excluded_from_capture(window: &tauri::WebviewWindow, excluded: bool) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
    };

    let Ok(hwnd) = window.hwnd() else {
        return false;
    };
    let affinity = if excluded {
        WDA_EXCLUDEFROMCAPTURE
    } else {
        WDA_NONE
    };
    unsafe { SetWindowDisplayAffinity(hwnd.0 as _, affinity) != 0 }
}

#[cfg(windows)]
pub fn disable_window_transitions(window: &tauri::WebviewWindow) {
    use std::ffi::c_void;
    use windows_sys::Win32::Foundation::TRUE;
    use windows_sys::Win32::Graphics::Dwm::{DWMWA_TRANSITIONS_FORCEDISABLED, DwmSetWindowAttribute};

    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let disabled: i32 = TRUE;
    unsafe {
        DwmSetWindowAttribute(
            hwnd.0 as _,
            DWMWA_TRANSITIONS_FORCEDISABLED as u32,
            &disabled as *const i32 as *const c_void,
            std::mem::size_of::<i32>() as u32,
        );
    }
}

#[cfg(not(windows))]
pub fn set_excluded_from_capture(_window: &tauri::WebviewWindow, _excluded: bool) -> bool {
    false
}

#[cfg(not(windows))]
pub fn disable_window_transitions(_window: &tauri::WebviewWindow) {}
