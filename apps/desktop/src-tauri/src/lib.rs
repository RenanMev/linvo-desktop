mod app;
mod auth;
mod chat_store;
mod checklist;
mod panel;

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::WebviewWindow;

#[cfg(not(windows))]
use tauri::{PhysicalPosition, PhysicalSize};

static ANIMATION_GENERATION: AtomicU64 = AtomicU64::new(0);

const FRAME_INTERVAL: Duration = Duration::from_micros(6944);

#[derive(Deserialize)]
pub struct TargetBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn ease_out_cubic(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(3)
}

fn lerp(start: f64, end: f64, t: f64) -> f64 {
    start + (end - start) * t
}

#[cfg(windows)]
fn apply_bounds(
    window: &WebviewWindow,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};

    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let ok = unsafe {
        SetWindowPos(
            hwnd.0 as _,
            std::ptr::null_mut(),
            x,
            y,
            width as i32,
            height as i32,
            SWP_NOZORDER | SWP_NOACTIVATE,
        )
    };
    if ok == 0 {
        return Err("SetWindowPos failed".into());
    }
    Ok(())
}

#[cfg(not(windows))]
fn apply_bounds(
    window: &WebviewWindow,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn run_animation(
    window: &WebviewWindow,
    to: &TargetBounds,
    duration_ms: u64,
    generation: u64,
) -> Result<bool, String> {
    let from_pos = window.outer_position().map_err(|e| e.to_string())?;
    let from_size = window.outer_size().map_err(|e| e.to_string())?;

    let start = Instant::now();
    let duration = Duration::from_millis(duration_ms.max(1));

    loop {
        if ANIMATION_GENERATION.load(Ordering::SeqCst) != generation {
            return Ok(false);
        }

        let t = (start.elapsed().as_secs_f64() / duration.as_secs_f64()).min(1.0);
        let eased = ease_out_cubic(t);

        let x = lerp(from_pos.x as f64, f64::from(to.x), eased).round() as i32;
        let y = lerp(from_pos.y as f64, f64::from(to.y), eased).round() as i32;
        let width = lerp(from_size.width as f64, f64::from(to.width), eased).round() as u32;
        let height = lerp(from_size.height as f64, f64::from(to.height), eased).round() as u32;

        apply_bounds(window, x, y, width, height)?;

        if t >= 1.0 {
            return Ok(true);
        }

        std::thread::sleep(FRAME_INTERVAL);
    }
}

#[tauri::command]
async fn animate_window_bounds(
    window: WebviewWindow,
    to: TargetBounds,
    duration_ms: u64,
) -> Result<bool, String> {
    let generation = ANIMATION_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;

    tauri::async_runtime::spawn_blocking(move || {
        run_animation(&window, &to, duration_ms, generation)
    })
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
        .invoke_handler(tauri::generate_handler![
            animate_window_bounds,
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
            checklist::checklist_open,
            checklist::checklist_close,
            checklist::checklist_is_open,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
