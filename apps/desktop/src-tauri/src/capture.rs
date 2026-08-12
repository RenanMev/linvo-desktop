use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use image::{ExtendedColorType, ImageEncoder, RgbaImage, codecs::png::PngEncoder, imageops};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri::ipc::Response;
use xcap::{Monitor, Window};

const OVERLAY_LABEL: &str = "capture-overlay";
const OVERLAY_READY_EVENT: &str = "capture-overlay://ready";
const THUMBNAIL_MAX: u32 = 320;
const OWN_TITLE_MARKERS: &[&str] = &["Linvo Desktop", "Checklist"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSource {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub app_name: String,
    pub width: u32,
    pub height: u32,
    pub thumbnail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPayload {
    pub image_png_base64: String,
    pub width: u32,
    pub height: u32,
    pub origin_x: i32,
    pub origin_y: i32,
}

fn encode_png(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    PngEncoder::new(&mut buf)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;
    Ok(buf)
}

fn thumbnail_data_url(image: &RgbaImage) -> Result<String, String> {
    let max = image.width().max(image.height()).max(1);
    let scaled = if max <= THUMBNAIL_MAX {
        image.clone()
    } else {
        let scale = THUMBNAIL_MAX as f32 / max as f32;
        let width = ((image.width() as f32) * scale).round().max(1.0) as u32;
        let height = ((image.height() as f32) * scale).round().max(1.0) as u32;
        imageops::thumbnail(image, width, height)
    };
    let png = encode_png(&scaled)?;
    Ok(format!("data:image/png;base64,{}", BASE64.encode(png)))
}

fn own_pid() -> u32 {
    std::process::id()
}

fn is_own_window(window: &Window) -> bool {
    if window.pid().ok() == Some(own_pid()) {
        return true;
    }
    let title = window.title().unwrap_or_default();
    OWN_TITLE_MARKERS
        .iter()
        .any(|marker| title.eq_ignore_ascii_case(marker))
}

fn source_id(kind: &str, id: u32) -> String {
    format!("{kind}:{id}")
}

fn parse_source_id(id: &str) -> Result<(&str, u32), String> {
    let (kind, raw) = id
        .split_once(':')
        .ok_or_else(|| format!("id de fonte inválido: {id}"))?;
    let parsed = raw
        .parse::<u32>()
        .map_err(|_| format!("id de fonte inválido: {id}"))?;
    Ok((kind, parsed))
}

fn list_monitors() -> Result<Vec<CaptureSource>, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let mut sources = Vec::with_capacity(monitors.len());

    for (index, monitor) in monitors.iter().enumerate() {
        let width = monitor.width().unwrap_or(0);
        let height = monitor.height().unwrap_or(0);
        if width == 0 || height == 0 {
            continue;
        }

        let image = match monitor.capture_image() {
            Ok(image) => image,
            Err(_) => continue,
        };

        let id = monitor.id().unwrap_or(index as u32);
        let name = monitor
            .friendly_name()
            .or_else(|_| monitor.name())
            .unwrap_or_else(|_| format!("Tela {}", index + 1));
        let title = if monitor.is_primary().unwrap_or(false) {
            format!("{name} (principal)")
        } else {
            name
        };

        sources.push(CaptureSource {
            id: source_id("monitor", id),
            kind: "monitor".into(),
            title,
            app_name: "Display".into(),
            width,
            height,
            thumbnail: thumbnail_data_url(&image)?,
        });
    }

    Ok(sources)
}

fn list_windows() -> Result<Vec<CaptureSource>, String> {
    let windows = Window::all().map_err(|e| e.to_string())?;
    let mut sources = Vec::new();

    for window in windows {
        if is_own_window(&window) {
            continue;
        }
        if window.is_minimized().unwrap_or(true) {
            continue;
        }

        let width = window.width().unwrap_or(0);
        let height = window.height().unwrap_or(0);
        if width < 32 || height < 32 {
            continue;
        }

        let title = window.title().unwrap_or_default();
        if title.trim().is_empty() {
            continue;
        }

        let image = match window.capture_image() {
            Ok(image) => image,
            Err(_) => continue,
        };

        let id = window.id().map_err(|e| e.to_string())?;
        sources.push(CaptureSource {
            id: source_id("window", id),
            kind: "window".into(),
            title,
            app_name: window.app_name().unwrap_or_default(),
            width,
            height,
            thumbnail: thumbnail_data_url(&image)?,
        });
    }

    Ok(sources)
}

#[tauri::command]
pub async fn capture_list_sources(kind: Option<String>) -> Result<Vec<CaptureSource>, String> {
    let filter = kind.unwrap_or_else(|| "all".into());
    tauri::async_runtime::spawn_blocking(move || {
        let mut sources = Vec::new();
        if filter == "all" || filter == "monitor" {
            sources.extend(list_monitors()?);
        }
        if filter == "all" || filter == "window" {
            sources.extend(list_windows()?);
        }
        Ok(sources)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn capture_by_id(id: &str) -> Result<(RgbaImage, String), String> {
    let (kind, raw_id) = parse_source_id(id)?;
    match kind {
        "monitor" => {
            let monitors = Monitor::all().map_err(|e| e.to_string())?;
            let monitor = monitors
                .into_iter()
                .enumerate()
                .find(|(index, monitor)| monitor.id().unwrap_or(*index as u32) == raw_id)
                .map(|(_, monitor)| monitor)
                .ok_or_else(|| format!("monitor não encontrado: {id}"))?;
            let title = monitor
                .friendly_name()
                .or_else(|_| monitor.name())
                .unwrap_or_else(|_| "Tela".into());
            Ok((monitor.capture_image().map_err(|e| e.to_string())?, title))
        }
        "window" => {
            let windows = Window::all().map_err(|e| e.to_string())?;
            let window = windows
                .into_iter()
                .find(|window| window.id().ok() == Some(raw_id))
                .ok_or_else(|| format!("janela não encontrada: {id}"))?;
            if is_own_window(&window) {
                return Err("não é possível capturar a própria janela do Linvo".into());
            }
            let title = window.title().unwrap_or_else(|_| "Janela".into());
            Ok((window.capture_image().map_err(|e| e.to_string())?, title))
        }
        _ => Err(format!("tipo de fonte inválido: {kind}")),
    }
}

#[tauri::command]
pub async fn capture_source(id: String) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (image, _title) = capture_by_id(&id)?;
        let png = encode_png(&image)?;
        Ok(Response::new(png))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn capture_source_meta(id: String) -> Result<CaptureSource, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (image, title) = capture_by_id(&id)?;
        let kind = {
            let (kind, _) = parse_source_id(&id)?;
            kind.to_string()
        };
        Ok(CaptureSource {
            id,
            kind,
            title,
            app_name: String::new(),
            width: image.width(),
            height: image.height(),
            thumbnail: String::new(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn virtual_desktop_bounds(monitors: &[Monitor]) -> Result<(i32, i32, u32, u32), String> {
    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;

    for monitor in monitors {
        let x = monitor.x().map_err(|e| e.to_string())?;
        let y = monitor.y().map_err(|e| e.to_string())?;
        let width = monitor.width().map_err(|e| e.to_string())? as i32;
        let height = monitor.height().map_err(|e| e.to_string())? as i32;
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x + width);
        max_y = max_y.max(y + height);
    }

    if min_x == i32::MAX {
        return Err("nenhum monitor disponível".into());
    }

    Ok((
        min_x,
        min_y,
        (max_x - min_x) as u32,
        (max_y - min_y) as u32,
    ))
}

fn freeze_virtual_desktop() -> Result<OverlayPayload, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let (origin_x, origin_y, width, height) = virtual_desktop_bounds(&monitors)?;
    let mut canvas = RgbaImage::new(width, height);

    for monitor in monitors {
        let image = monitor.capture_image().map_err(|e| e.to_string())?;
        let x = monitor.x().map_err(|e| e.to_string())? - origin_x;
        let y = monitor.y().map_err(|e| e.to_string())? - origin_y;
        imageops::overlay(&mut canvas, &image, x as i64, y as i64);
    }

    let png = encode_png(&canvas)?;
    Ok(OverlayPayload {
        image_png_base64: BASE64.encode(png),
        width,
        height,
        origin_x,
        origin_y,
    })
}

fn overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(OVERLAY_LABEL)
        .ok_or_else(|| format!("window '{OVERLAY_LABEL}' not found"))
}

#[tauri::command]
pub async fn capture_overlay_open(app: AppHandle) -> Result<(), String> {
    let payload = tauri::async_runtime::spawn_blocking(freeze_virtual_desktop)
        .await
        .map_err(|e| e.to_string())??;

    let overlay = overlay_window(&app)?;
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let (origin_x, origin_y, width, height) = virtual_desktop_bounds(&monitors)?;

    overlay
        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|e| e.to_string())?;
    overlay
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: origin_x,
            y: origin_y,
        }))
        .map_err(|e| e.to_string())?;
    overlay.set_always_on_top(true).map_err(|e| e.to_string())?;
    overlay.show().map_err(|e| e.to_string())?;
    overlay.set_focus().map_err(|e| e.to_string())?;
    app.emit_to(OVERLAY_LABEL, OVERLAY_READY_EVENT, payload)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn capture_overlay_close(app: AppHandle) -> Result<(), String> {
    let overlay = overlay_window(&app)?;
    overlay.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(windows)]
fn element_rect_at(x: i32, y: i32) -> Result<CaptureRect, String> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };
    use windows::Win32::UI::Accessibility::{CUIAutomation, IUIAutomation, IUIAutomationElement};
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowRect, WindowFromPoint};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let automation: IUIAutomation =
            CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let point = POINT { x, y };

        if let Ok(element) = automation.ElementFromPoint(point) {
            let element: IUIAutomationElement = element;
            if let Ok(rect) = element.CurrentBoundingRectangle() {
                let width = rect.right - rect.left;
                let height = rect.bottom - rect.top;
                if width >= 8 && height >= 8 {
                    return Ok(CaptureRect {
                        x: rect.left,
                        y: rect.top,
                        width,
                        height,
                    });
                }
            }
        }

        let hwnd = WindowFromPoint(point);
        if hwnd.0.is_null() {
            return Err("nenhum elemento sob o cursor".into());
        }

        let mut rect = windows::Win32::Foundation::RECT::default();
        GetWindowRect(hwnd, &mut rect).map_err(|e| e.to_string())?;
        Ok(CaptureRect {
            x: rect.left,
            y: rect.top,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top,
        })
    }
}

#[cfg(not(windows))]
fn element_rect_at(_x: i32, _y: i32) -> Result<CaptureRect, String> {
    Err("magnetismo de elementos só está disponível no Windows".into())
}

#[tauri::command]
pub async fn capture_element_at(x: i32, y: i32) -> Result<CaptureRect, String> {
    tauri::async_runtime::spawn_blocking(move || element_rect_at(x, y))
        .await
        .map_err(|e| e.to_string())?
}
