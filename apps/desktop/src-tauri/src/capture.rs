use std::sync::{Mutex, OnceLock};

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use image::{ExtendedColorType, ImageEncoder, RgbaImage, codecs::png::PngEncoder, imageops};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri::ipc::Response;
use xcap::{Monitor, Window};

pub const OVERLAY_LABEL: &str = "capture-overlay";
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Alvo de magnetismo, em pixels físicos da área de trabalho virtual.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    /// "window" ou "monitor" — o overlay prefere janelas e cai no monitor.
    pub kind: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPayload {
    pub width: u32,
    pub height: u32,
    pub origin_x: i32,
    pub origin_y: i32,
    /// Janelas (topo primeiro) e monitores, capturados antes do overlay subir.
    pub snap_rects: Vec<SnapRect>,
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

/*
 * A lista sai **sem** miniatura de propósito. Montá-la capturando e codificando
 * em PNG+base64 toda janela e todo monitor aberto custava segundos com o seletor
 * mostrando só um spinner. Aqui a lista sai de chamadas de metadata (baratas) e
 * cada miniatura é buscada depois, por linha, via `capture_source_thumbnail`.
 */
fn list_monitors() -> Result<Vec<CaptureSource>, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let mut sources = Vec::with_capacity(monitors.len());

    for (index, monitor) in monitors.iter().enumerate() {
        let width = monitor.width().unwrap_or(0);
        let height = monitor.height().unwrap_or(0);
        if width == 0 || height == 0 {
            continue;
        }

        let id = monitor.id().unwrap_or(index as u32);
        let name = monitor
            .name()
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
            thumbnail: String::new(),
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

        let id = window.id().map_err(|e| e.to_string())?;
        sources.push(CaptureSource {
            id: source_id("window", id),
            kind: "window".into(),
            title,
            app_name: window.app_name().unwrap_or_default(),
            width,
            height,
            thumbnail: String::new(),
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

/// Miniatura de uma fonte, buscada sob demanda pelo seletor.
#[tauri::command]
pub async fn capture_source_thumbnail(id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (image, _title) = capture_by_id(&id)?;
        thumbnail_data_url(&image)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Pixels da fonte escolhida.
///
/// Não existe mais um `capture_source_meta` ao lado: aquele comando capturava a
/// fonte inteira de novo só para ler `width`/`height` e jogar os pixels fora, e
/// o front o disparava em paralelo com este — toda seleção custava duas
/// capturas. As dimensões saem da própria lista do seletor.
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

/// Recorta a região pedida capturando **só** ela, direto dos monitores.
///
/// Antes o app congelava a área de trabalho inteira na abertura do overlay
/// (~15 MB de alocação + BitBlt de cada monitor + composição pixel a pixel) e
/// recortava desse frame. Isso custava 60-200 ms *antes* de qualquer coisa
/// aparecer na tela, para no fim usar um pedaço pequeno da imagem. Agora nada é
/// capturado na abertura: só aqui, no confirm, e só o retângulo escolhido.
fn capture_region(region: &CaptureRect) -> Result<RgbaImage, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let width = region.width.max(1) as u32;
    let height = region.height.max(1) as u32;

    // Interseções da região com cada monitor, em coordenadas do próprio monitor.
    let mut parts = Vec::new();
    for monitor in &monitors {
        let (Ok(mx), Ok(my), Ok(mw), Ok(mh)) = (
            monitor.x(),
            monitor.y(),
            monitor.width(),
            monitor.height(),
        ) else {
            continue;
        };

        let left = region.x.max(mx);
        let top = region.y.max(my);
        let right = (region.x + region.width).min(mx + mw as i32);
        let bottom = (region.y + region.height).min(my + mh as i32);
        if right <= left || bottom <= top {
            continue;
        }

        parts.push((
            monitor,
            // Origem dentro do monitor.
            (left - mx) as u32,
            (top - my) as u32,
            (right - left) as u32,
            (bottom - top) as u32,
            // Destino dentro do recorte.
            (left - region.x) as i64,
            (top - region.y) as i64,
        ));
    }

    if parts.is_empty() {
        return Err("a região escolhida não está em nenhum monitor".into());
    }

    // Caso comum: a seleção cabe num monitor só, então a captura já é o recorte.
    if let [(monitor, sx, sy, sw, sh, ..)] = parts.as_slice() {
        return monitor
            .capture_region(*sx, *sy, *sw, *sh)
            .map_err(|e| e.to_string());
    }

    let mut canvas = RgbaImage::new(width, height);
    for (monitor, sx, sy, sw, sh, dx, dy) in &parts {
        let part = monitor
            .capture_region(*sx, *sy, *sw, *sh)
            .map_err(|e| e.to_string())?;
        /*
         * `replace` copia; `imageops::overlay` faz blend e o `Rgba<u8>::blend`
         * retorna sem escrever quando o alpha da origem é 0. O GDI às vezes
         * devolve alpha zerado, e era isso que podia deixar buracos
         * transparentes no recorte.
         */
        imageops::replace(&mut canvas, &part, *dx, *dy);
    }
    Ok(canvas)
}

/*
 * O overlay é uma janela always-on-top que cobre a área de trabalho inteira,
 * então perguntar ao Windows "que elemento está sob o cursor?" depois dele subir
 * sempre responde "o overlay" — e o magnetismo passa a devolver a tela toda, sem
 * distinguir janela nem monitor. A lista é montada aqui, antes do `show()`, e as
 * nossas próprias janelas ficam de fora. Mesma estratégia do ShareX
 * (`WindowsRectangleList` + `IgnoreHandleList`).
 */
#[cfg(windows)]
fn snap_targets(own: &[isize], monitors: &[Monitor]) -> Vec<SnapRect> {
    use std::ffi::c_void;
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT, TRUE};
    use windows_sys::Win32::Graphics::Dwm::{
        DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS, DwmGetWindowAttribute,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GWL_EXSTYLE, GetWindowLongPtrW, GetWindowRect, GetWindowTextLengthW,
        GetWindowTextW, IsWindowVisible, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    struct EnumState<'a> {
        own: &'a [isize],
        out: Vec<SnapRect>,
    }

    fn window_title(hwnd: HWND) -> String {
        unsafe {
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return String::new();
            }
            let mut buf = vec![0u16; len as usize + 1];
            let written = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if written <= 0 {
                return String::new();
            }
            String::from_utf16_lossy(&buf[..written as usize])
        }
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = unsafe { &mut *(lparam as *mut EnumState) };

        if state.own.contains(&(hwnd as isize)) {
            return TRUE;
        }
        if unsafe { IsWindowVisible(hwnd) } == 0 {
            return TRUE;
        }

        // Janelas UWP suspensas continuam "visíveis" para o Win32 mas não são
        // desenhadas; sem este filtro o magnetismo gruda em fantasmas.
        let mut cloaked: u32 = 0;
        let cloaked_ok = unsafe {
            DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED as u32,
                &mut cloaked as *mut u32 as *mut c_void,
                std::mem::size_of::<u32>() as u32,
            )
        };
        if cloaked_ok == 0 && cloaked != 0 {
            return TRUE;
        }

        let ex_style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) } as u32;
        if ex_style & WS_EX_TOOLWINDOW != 0 && ex_style & WS_EX_NOACTIVATE != 0 {
            return TRUE;
        }

        // `GetWindowRect` inclui a borda invisível de redimensionamento do DWM;
        // o frame estendido é o retângulo que o usuário enxerga.
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        let frame_ok = unsafe {
            DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS as u32,
                &mut rect as *mut RECT as *mut c_void,
                std::mem::size_of::<RECT>() as u32,
            )
        };
        if frame_ok != 0 && unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            return TRUE;
        }

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width < 16 || height < 16 {
            return TRUE;
        }

        state.out.push(SnapRect {
            x: rect.left,
            y: rect.top,
            width,
            height,
            kind: "window".into(),
            title: window_title(hwnd),
        });
        TRUE
    }

    let mut state = EnumState {
        own,
        out: Vec::new(),
    };
    // EnumWindows entrega da janela mais ao topo para a mais ao fundo, que é
    // exatamente a ordem em que o hit-test precisa resolver empates.
    unsafe {
        EnumWindows(Some(enum_proc), &mut state as *mut EnumState as LPARAM);
    }

    let mut rects = state.out;
    for monitor in monitors {
        let (Ok(x), Ok(y), Ok(width), Ok(height)) = (
            monitor.x(),
            monitor.y(),
            monitor.width(),
            monitor.height(),
        ) else {
            continue;
        };
        rects.push(SnapRect {
            x,
            y,
            width: width as i32,
            height: height as i32,
            kind: "monitor".into(),
            title: monitor
                .friendly_name()
                .or_else(|_| monitor.name())
                .unwrap_or_else(|_| "Tela".into()),
        });
    }
    rects
}

#[cfg(not(windows))]
fn snap_targets(_own: &[isize], monitors: &[Monitor]) -> Vec<SnapRect> {
    monitors
        .iter()
        .filter_map(|monitor| {
            let (Ok(x), Ok(y), Ok(width), Ok(height)) = (
                monitor.x(),
                monitor.y(),
                monitor.width(),
                monitor.height(),
            ) else {
                return None;
            };
            Some(SnapRect {
                x,
                y,
                width: width as i32,
                height: height as i32,
                kind: "monitor".into(),
                title: String::new(),
            })
        })
        .collect()
}

/// Handles nativos das nossas janelas, para não magnetizar no próprio app.
fn own_window_handles(app: &AppHandle) -> Vec<isize> {
    #[cfg(windows)]
    {
        app.webview_windows()
            .values()
            .filter_map(|window| window.hwnd().ok())
            .map(|hwnd| hwnd.0 as isize)
            .collect()
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Vec::new()
    }
}

fn overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(OVERLAY_LABEL)
        .ok_or_else(|| format!("window '{OVERLAY_LABEL}' not found"))
}

/// Janelas escondidas para a captura, na ordem em que devem voltar.
static HIDDEN_WINDOWS: OnceLock<Mutex<Vec<String>>> = OnceLock::new();
/// Último payload emitido, para o overlay poder puxá-lo se perdeu o evento.
static PENDING_PAYLOAD: OnceLock<Mutex<Option<OverlayPayload>>> = OnceLock::new();

fn hidden_windows() -> &'static Mutex<Vec<String>> {
    HIDDEN_WINDOWS.get_or_init(|| Mutex::new(Vec::new()))
}

fn pending_payload() -> &'static Mutex<Option<OverlayPayload>> {
    PENDING_PAYLOAD.get_or_init(|| Mutex::new(None))
}

/*
 * As nossas janelas saem da tela por dois motivos diferentes, e só um deles
 * precisa de espera:
 *
 * 1. Não atrapalhar a visão do usuário — resolvido por `hide()`, imediato.
 * 2. Não sair dentro do print — resolvido por `WDA_EXCLUDEFROMCAPTURE`, que age
 *    no compositor e vale já no quadro seguinte.
 *
 * Antes só existia o `hide()`, e como o DWM leva um quadro para parar de
 * desenhar a janela, era preciso dormir 120 ms antes de capturar. Com a flag de
 * exclusão essa espera some: mesmo que a janela ainda esteja composta na tela,
 * ela já não está na superfície que o BitBlt lê.
 */
fn hide_own_windows(app: &AppHandle) -> Result<(), String> {
    let mut hidden = hidden_windows().lock().map_err(|e| e.to_string())?;
    hidden.clear();

    let mut labels: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|label| *label != OVERLAY_LABEL)
        .cloned()
        .collect();
    // `webview_windows` é um HashMap: sem ordenar, qual janela recebe o foco na
    // volta mudava de uma execução para outra.
    labels.sort();

    for label in labels {
        let Some(window) = app.get_webview_window(&label) else {
            continue;
        };
        crate::win_capture_flags::set_excluded_from_capture(&window, true);
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            hidden.push(label);
        }
    }

    // Fallback para Windows < 10 2004, onde a exclusão de captura não existe e o
    // fantasma só some quando o compositor redesenha.
    if !hidden.is_empty() && !crate::win_capture_flags::exclusion_supported() {
        std::thread::sleep(std::time::Duration::from_millis(120));
    }
    Ok(())
}

/// Devolve as janelas escondidas e religa a captura delas.
///
/// **Sempre depois** de a região já ter sido capturada: enquanto a exclusão está
/// ligada, nada do Linvo entra no print mesmo que a janela já tenha reaparecido.
/// Fazer isso na ordem inversa devolvia o chat para a tela a tempo de ele sair
/// dentro da própria captura.
fn restore_own_windows(app: &AppHandle, focus: Option<&str>) {
    let Ok(mut hidden) = hidden_windows().lock() else {
        return;
    };
    let restored: Vec<String> = hidden.drain(..).collect();

    for (label, window) in app.webview_windows() {
        if label != OVERLAY_LABEL {
            crate::win_capture_flags::set_excluded_from_capture(&window, false);
        }
    }

    for label in &restored {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.show();
        }
    }

    // O foco vai para quem pediu a captura; sem isso ele caía numa janela
    // qualquer e o chat não voltava em primeiro plano.
    let target = focus
        .filter(|label| restored.iter().any(|l| l == label))
        .or_else(|| restored.first().map(String::as_str));
    if let Some(window) = target.and_then(|label| app.get_webview_window(label)) {
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub async fn capture_overlay_open(app: AppHandle) -> Result<(), String> {
    let hide_app = app.clone();
    let snap_app = app.clone();

    /*
     * Tudo o que roda antes do `show()` é latência que o usuário sente como
     * "cliquei e não aconteceu nada". Sobrou só o necessário: esconder as nossas
     * janelas, enumerar monitores uma vez e montar a lista do magnetismo.
     */
    let (payload, bounds) = tauri::async_runtime::spawn_blocking(move || {
        hide_own_windows(&hide_app)?;

        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        let (origin_x, origin_y, width, height) = virtual_desktop_bounds(&monitors)?;
        // Antes do `show()`: depois dele o overlay é a janela do topo em todo lugar.
        let snap_rects = snap_targets(&own_window_handles(&snap_app), &monitors);

        Ok::<_, String>((
            OverlayPayload {
                width,
                height,
                origin_x,
                origin_y,
                snap_rects,
            },
            (origin_x, origin_y, width, height),
        ))
    })
    .await
    .map_err(|e| e.to_string())??;

    let (origin_x, origin_y, width, height) = bounds;
    let overlay = overlay_window(&app)?;

    {
        let mut slot = pending_payload().lock().map_err(|e| e.to_string())?;
        *slot = Some(payload.clone());
    }

    /*
     * Emitir **antes** do `show()`. A janela é pré-criada no `tauri.conf.json` e
     * nunca destruída, então o webview já está montado e escutando: quando ela
     * pinta, o payload já chegou. Na ordem inversa o overlay aparecia primeiro e
     * ficava alguns quadros mostrando um placeholder escuro sobre a tela inteira.
     */
    app.emit_to(OVERLAY_LABEL, OVERLAY_READY_EVENT, payload)
        .map_err(|e| e.to_string())?;

    overlay
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: origin_x,
            y: origin_y,
        }))
        .map_err(|e| e.to_string())?;
    overlay
        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|e| e.to_string())?;
    overlay.set_always_on_top(true).map_err(|e| e.to_string())?;
    overlay.show().map_err(|e| e.to_string())?;
    overlay.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Payload da sessão em andamento, para o overlay que perdeu o evento `ready`.
///
/// `listen()` registra de forma assíncrona; entre o React montar e o registro
/// completar existe uma janela em que um `emit_to` cai no vazio (reload do
/// WebView2, HMR, StrictMode). Sem isto o overlay ficava preso em "preparando"
/// para sempre, e quem pediu a captura ficava com `isCapturing` travado.
#[tauri::command]
pub async fn capture_overlay_payload() -> Result<Option<OverlayPayload>, String> {
    let slot = pending_payload().lock().map_err(|e| e.to_string())?;
    Ok(slot.clone())
}

/// Captura só a região escolhida, devolve o PNG dela e devolve as janelas.
///
/// A restauração acontece **aqui**, depois da captura, e não no
/// `capture_overlay_close`: o overlay fecha assim que confirma, mas quem pede o
/// recorte é a outra janela, logo depois. Restaurar no fechamento deixava o chat
/// reaparecer bem a tempo de sair dentro do próprio print.
#[tauri::command]
pub async fn capture_overlay_region(
    app: AppHandle,
    region: CaptureRect,
    focus: Option<String>,
) -> Result<Response, String> {
    let captured = tauri::async_runtime::spawn_blocking(move || {
        if region.width < 1 || region.height < 1 {
            return Err("região de recorte inválida".into());
        }
        let image = capture_region(&region)?;
        encode_png(&image)
    })
    .await
    .map_err(|e| e.to_string())?;

    // Mesmo se a captura falhar, as janelas precisam voltar.
    restore_own_windows(&app, focus.as_deref());
    captured.map(Response::new)
}

/// Fecha o overlay. `restore` só é falso no confirm, onde quem devolve as
/// janelas é o `capture_overlay_region`, depois de já ter capturado.
#[tauri::command]
pub async fn capture_overlay_close(
    app: AppHandle,
    focus: Option<String>,
    restore: Option<bool>,
) -> Result<(), String> {
    let overlay = overlay_window(&app)?;
    overlay.hide().map_err(|e| e.to_string())?;

    if let Ok(mut slot) = pending_payload().lock() {
        *slot = None;
    }

    if restore.unwrap_or(true) {
        restore_own_windows(&app, focus.as_deref());
    }
    Ok(())
}

