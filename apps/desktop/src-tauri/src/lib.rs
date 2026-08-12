mod app;
mod auth;
mod capture;
mod chat_store;
mod checklist;
mod documents;
mod panel;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;

#[cfg(not(windows))]
use tauri::{PhysicalPosition, PhysicalSize};

static ANIMATION_GENERATION: AtomicU64 = AtomicU64::new(0);

/// Serializa toda mutação de bounds da janela.
///
/// A checagem de geração e o `SetWindowPos` do frame precisam ser atômicos entre
/// si: sem isso, `set_window_bounds` podia entrar entre as duas e aplicar os
/// bounds finais, e o frame intermediário já calculado pousava por cima deles —
/// a animação retornava `false` (cancelada) com a janela parada no meio do
/// caminho.
static WINDOW_MUTATION: Mutex<()> = Mutex::new(());

// 60fps. A cada frame o WebView2 refaz o layout do DOM inteiro da janela
// (SetWindowPos dispara resize do webview); a ~144fps isso não sustenta e
// a animação trepida.
const FRAME_INTERVAL: Duration = Duration::from_micros(16667);

/// Mesmo default do front (`DEFAULT_ANIMATION_DURATION_MS`).
const DEFAULT_ANIMATION_DURATION_MS: u64 = 200;

fn lock_window_mutation() -> MutexGuard<'static, ()> {
    // Um panic em outra mutação não pode travar as janelas do app para sempre.
    WINDOW_MUTATION
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Bounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

/// Como o `SetWindowPos` cruza para a thread dona da HWND.
#[derive(Clone, Copy, PartialEq, Eq)]
enum ApplyMode {
    /// Bloqueia até a thread do message pump processar — ou seja, até o
    /// relayout inteiro do WebView2 terminar. Necessário quando quem chamou
    /// precisa assumir que a janela já está no destino quando o comando resolve.
    Blocking,
    /// Enfileira o pedido (`SWP_ASYNCWINDOWPOS`) em vez de bloquear. Pedidos
    /// enfileirados são processados em ordem entre si.
    Queued,
}

fn ease_out_cubic(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(3)
}

fn lerp(start: f64, end: f64, t: f64) -> f64 {
    start + (end - start) * t
}

fn interpolate(from: Bounds, to: Bounds, eased: f64) -> Bounds {
    Bounds {
        x: lerp(f64::from(from.x), f64::from(to.x), eased).round() as i32,
        y: lerp(f64::from(from.y), f64::from(to.y), eased).round() as i32,
        width: lerp(f64::from(from.width), f64::from(to.width), eased).round() as u32,
        height: lerp(f64::from(from.height), f64::from(to.height), eased).round() as u32,
    }
}

/// Sobe a resolução do timer do sistema para 1ms enquanto existir.
///
/// `std::thread::sleep` no Windows vira `Sleep()`, que arredonda para cima até o
/// próximo tick do timer do sistema — ~15,6ms por padrão. Um sleep de 16,6ms
/// vira 31,2ms e o período de frame passa a variar na faixa dos 40fps, o que
/// sozinho já explica trepidação independente do WebView2. O par
/// `timeBeginPeriod`/`timeEndPeriod` é refcontado pelo SO, então guards
/// concorrentes se compõem.
#[cfg(windows)]
struct HighResTimer;

#[cfg(windows)]
impl HighResTimer {
    fn acquire() -> Self {
        unsafe { windows_sys::Win32::Media::timeBeginPeriod(1) };
        Self
    }
}

#[cfg(windows)]
impl Drop for HighResTimer {
    fn drop(&mut self) {
        unsafe { windows_sys::Win32::Media::timeEndPeriod(1) };
    }
}

#[cfg(windows)]
fn apply_bounds(window: &WebviewWindow, bounds: Bounds, mode: ApplyMode) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOZORDER,
    };

    let mut flags = SWP_NOZORDER | SWP_NOACTIVATE;
    if mode == ApplyMode::Queued {
        flags |= SWP_ASYNCWINDOWPOS;
    }

    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let ok = unsafe {
        SetWindowPos(
            hwnd.0 as _,
            std::ptr::null_mut(),
            bounds.x,
            bounds.y,
            bounds.width as i32,
            bounds.height as i32,
            flags,
        )
    };
    if ok == 0 {
        return Err("SetWindowPos failed".into());
    }
    Ok(())
}

/// Duas mutações: dois relayouts e um "shear" visível (redimensiona, depois
/// move). `WebviewWindow::set_bounds` do Tauri 2.11 não resolve — ele mexe na
/// área de cliente do *webview*, não no frame da janela. O caminho nativo no
/// macOS é deixar o AppKit animar (`NSAnimationContext`) em vez do loop em Rust.
#[cfg(not(windows))]
fn apply_bounds(window: &WebviewWindow, bounds: Bounds, _mode: ApplyMode) -> Result<(), String> {
    window
        .set_size(PhysicalSize::new(bounds.width, bounds.height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Reenfileira os bounds atrás de frames que a animação já postou.
///
/// `SetWindowPos` síncrono cruza a thread como mensagem *enviada*, e mensagens
/// enviadas passam na frente das postadas: um frame de animação postado antes do
/// cancelamento seria processado *depois* dos bounds finais e deixaria a janela
/// no estado intermediário. Repostar o destino o coloca no fim da mesma fila.
/// Como os bounds são idênticos aos que acabaram de ser aplicados, no caso comum
/// não gera `WM_SIZE` nem relayout.
#[cfg(windows)]
fn requeue_bounds(window: &WebviewWindow, bounds: Bounds) -> Result<(), String> {
    apply_bounds(window, bounds, ApplyMode::Queued)
}

#[cfg(not(windows))]
fn requeue_bounds(_window: &WebviewWindow, _bounds: Bounds) -> Result<(), String> {
    Ok(())
}

/// Checa a geração e aplica o frame sob o mesmo lock.
/// `Ok(false)` = a animação foi superada e não deve tocar mais na janela.
fn apply_frame(window: &WebviewWindow, bounds: Bounds, generation: u64) -> Result<bool, String> {
    let _guard = lock_window_mutation();
    if ANIMATION_GENERATION.load(Ordering::SeqCst) != generation {
        return Ok(false);
    }
    apply_bounds(window, bounds, ApplyMode::Queued)?;
    Ok(true)
}

fn run_animation(
    window: &WebviewWindow,
    to: Bounds,
    duration_ms: u64,
    generation: u64,
) -> Result<bool, String> {
    let from_pos = window.outer_position().map_err(|e| e.to_string())?;
    let from_size = window.outer_size().map_err(|e| e.to_string())?;
    let from = Bounds {
        x: from_pos.x,
        y: from_pos.y,
        width: from_size.width,
        height: from_size.height,
    };

    // Sem isto o pacing abaixo não vale nada: o sleep é arredondado para o tick
    // do timer do sistema.
    #[cfg(windows)]
    let _timer = HighResTimer::acquire();

    let start = Instant::now();
    let duration = Duration::from_millis(duration_ms.max(1));
    // Começa com os bounds atuais já marcados como aplicados: o frame em t = 0
    // reaplicaria exatamente eles, um relayout do WebView2 de graça.
    let mut last = from;

    loop {
        let t = (start.elapsed().as_secs_f64() / duration.as_secs_f64()).min(1.0);
        let done = t >= 1.0;
        let next = interpolate(from, to, ease_out_cubic(t));

        // Na cauda do ease-out vários frames seguidos arredondam para os mesmos
        // pixels. Reaplicar não move nada e custa um relayout completo do DOM.
        if next != last {
            match apply_frame(window, next, generation) {
                Ok(true) => last = next,
                Ok(false) => return Ok(false),
                Err(err) => {
                    // Um Err no meio deixaria a janela num tamanho intermediário;
                    // pior que um Err com ela no destino.
                    let _ = apply_frame(window, to, generation);
                    return Err(err);
                }
            }
        }

        if done {
            return Ok(true);
        }

        // Índice do frame derivado do tempo decorrido, não incrementado. Com um
        // contador, um frame que estoura o orçamento deixava o índice atrás do
        // relógio: `checked_duration_since` retornava `None` várias iterações
        // seguidas e o loop rodava sem dormir até recuperar — o frame atrasado
        // virava uma rajada de `SetWindowPos`, que é o que se enxerga como
        // trepidação. Derivando, um frame perdido é pulado, não recuperado.
        let elapsed = start.elapsed();
        let next_frame = (elapsed.as_micros() / FRAME_INTERVAL.as_micros()) as u32 + 1;
        if let Some(remaining) =
            (start + FRAME_INTERVAL * next_frame).checked_duration_since(Instant::now())
        {
            std::thread::sleep(remaining);
        }
    }
}

/// Aplica bounds numa única chamada, sem animar.
///
/// O WebView2 refaz o layout do DOM inteiro a cada `SetWindowPos`, então animar
/// o tamanho da janela frame a frame trepida por construção (é mais grave no
/// Tauri que no Wry — tauri-apps/tauri#6322). Para transições, o caminho liso é
/// redimensionar de uma vez e animar o conteúdo por transform no CSS.
#[tauri::command]
fn set_window_bounds(window: WebviewWindow, to: Bounds) -> Result<(), String> {
    let _guard = lock_window_mutation();
    // Invalida animação em voo para ela não sobrescrever estes bounds.
    ANIMATION_GENERATION.fetch_add(1, Ordering::SeqCst);
    // Síncrono: o front assume que a janela já está no tamanho final quando isto
    // resolve (é o que impede o painel de pintar recortado dentro da pílula).
    apply_bounds(&window, to, ApplyMode::Blocking)?;
    requeue_bounds(&window, to)
}

#[tauri::command]
fn monitor_work_area(window: WebviewWindow) -> Result<Bounds, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor found".to_string())?;
    let work_area = monitor.work_area();
    Ok(Bounds {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    })
}

#[tauri::command]
async fn animate_window_bounds(
    window: WebviewWindow,
    to: Bounds,
    duration_ms: Option<u64>,
) -> Result<bool, String> {
    let duration = duration_ms.unwrap_or(DEFAULT_ANIMATION_DURATION_MS);
    let generation = {
        let _guard = lock_window_mutation();
        ANIMATION_GENERATION.fetch_add(1, Ordering::SeqCst) + 1
    };

    tauri::async_runtime::spawn_blocking(move || run_animation(&window, to, duration, generation))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            use tauri::Manager;
            if let Some(panel) = app.get_webview_window("panel") {
                panel::init_native_blur(&panel);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            animate_window_bounds,
            set_window_bounds,
            monitor_work_area,
            app::app_quit,
            auth::auth_set_tokens,
            auth::auth_get_tokens,
            auth::auth_clear_tokens,
            chat_store::chat_load_conversations,
            chat_store::chat_save_conversations,
            chat_store::chat_load_messages,
            chat_store::chat_save_messages,
            chat_store::chat_clear_cache,
            panel::panel_open,
            panel::panel_close,
            panel::panel_is_open,
            panel::panel_set_blur,
            checklist::checklist_open,
            checklist::checklist_close,
            checklist::checklist_is_open,
            documents::documents_save_file,
            capture::capture_list_sources,
            capture::capture_source,
            capture::capture_source_meta,
            capture::capture_overlay_open,
            capture::capture_overlay_close,
            capture::capture_element_at,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
