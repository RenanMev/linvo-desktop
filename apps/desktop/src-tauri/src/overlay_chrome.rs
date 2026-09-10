use std::sync::atomic::AtomicIsize;
#[cfg(windows)]
use std::sync::atomic::Ordering;
use std::sync::{Mutex, MutexGuard, OnceLock};

#[cfg(windows)]
use std::thread;
#[cfg(windows)]
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewWindow};

use crate::Bounds;
use crate::capture::OVERLAY_LABEL;

#[cfg(windows)]
const HIT_TEST_INTERVAL: Duration = Duration::from_millis(32);
#[cfg(windows)]
const TOPMOST_INTERVAL: Duration = Duration::from_millis(500);
pub(crate) const MAIN_LABEL: &str = "main";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayChromeStatus {
    pub no_activate_ok: bool,
    pub click_through: bool,
    pub exclude_from_capture: bool,
    pub topmost_guard: bool,
    pub win32_ok: bool,
}

#[cfg_attr(not(windows), allow(dead_code))]
struct OverlayChromeState {
    click_through: bool,
    holes: Vec<Bounds>,
    hit_gen: u64,
    /// Token da thread dona do loop de hit-test; zero = nenhuma rodando.
    hit_thread: u64,
    topmost_guard: bool,
    /// Idem para o loop de topmost.
    topmost_thread: u64,
    next_thread_token: u64,
    exclude_from_capture: bool,
    no_activate_ok: bool,
    win32_ok: bool,
}

static STATE: OnceLock<Mutex<OverlayChromeState>> = OnceLock::new();
#[cfg_attr(not(windows), allow(dead_code))]
static PREVIOUS_HWND: AtomicIsize = AtomicIsize::new(0);

fn lock_state() -> MutexGuard<'static, OverlayChromeState> {
    STATE
        .get_or_init(|| {
            Mutex::new(OverlayChromeState {
                click_through: false,
                holes: Vec::new(),
                hit_gen: 0,
                hit_thread: 0,
                topmost_guard: false,
                topmost_thread: 0,
                next_thread_token: 0,
                exclude_from_capture: false,
                no_activate_ok: true,
                win32_ok: true,
            })
        })
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn snapshot() -> OverlayChromeStatus {
    let s = lock_state();
    OverlayChromeStatus {
        no_activate_ok: s.no_activate_ok,
        click_through: s.click_through,
        exclude_from_capture: s.exclude_from_capture,
        topmost_guard: s.topmost_guard,
        win32_ok: s.win32_ok,
    }
}

pub(crate) fn mark_win32_failed() {
    let mut s = lock_state();
    s.no_activate_ok = false;
    s.win32_ok = false;
}

#[cfg_attr(not(windows), allow(dead_code))]
#[derive(Clone, Copy)]
enum ThreadSlot {
    HitTest,
    Topmost,
}

impl ThreadSlot {
    fn token_of(self, state: &mut OverlayChromeState) -> &mut u64 {
        match self {
            ThreadSlot::HitTest => &mut state.hit_thread,
            ThreadSlot::Topmost => &mut state.topmost_thread,
        }
    }
}

/// Reserva a vaga do loop na mesma seção crítica que liga o modo.
///
/// Antes a decisão saía de `JoinHandle::is_finished`: uma thread já a caminho da
/// saída ainda contava como viva, então religar no mesmo instante não criava a
/// substituta e o polling morria com o modo ligado.
#[cfg_attr(not(windows), allow(dead_code))]
fn claim_thread(state: &mut OverlayChromeState, slot: ThreadSlot) -> Option<u64> {
    if *slot.token_of(state) != 0 {
        return None;
    }
    state.next_thread_token = state.next_thread_token.wrapping_add(1);
    let token = state.next_thread_token;
    *slot.token_of(state) = token;
    Some(token)
}

/// `true` para o loop seguir. Solta a vaga na mesma seção crítica em que decide
/// sair, para o próximo `enabled = true` já poder criar a substituta.
#[cfg_attr(not(windows), allow(dead_code))]
fn keep_running(
    state: &mut OverlayChromeState,
    slot: ThreadSlot,
    token: u64,
    still_on: bool,
) -> bool {
    let owner = slot.token_of(state);
    if *owner != token {
        return false;
    }
    if still_on {
        return true;
    }
    *owner = 0;
    false
}

/// Devolve a vaga se o loop cair por panic; no fim normal o `keep_running` já
/// zerou o token e este drop vira no-op.
#[cfg(windows)]
struct ThreadSlotGuard {
    slot: ThreadSlot,
    token: u64,
}

#[cfg(windows)]
impl Drop for ThreadSlotGuard {
    fn drop(&mut self) {
        let mut state = lock_state();
        if *self.slot.token_of(&mut state) == self.token {
            *self.slot.token_of(&mut state) = 0;
        }
    }
}

pub(crate) fn point_in_holes(x: i32, y: i32, holes: &[Bounds]) -> bool {
    holes.iter().any(|hole| {
        x >= hole.x
            && y >= hole.y
            && x < hole.x + hole.width as i32
            && y < hole.y + hole.height as i32
    })
}

#[cfg(windows)]
fn set_click_through_now(window: &WebviewWindow, ignore: bool) -> bool {
    window.set_ignore_cursor_events(ignore).is_ok()
}

#[cfg(windows)]
fn cursor_in_holes(window: &WebviewWindow, holes: &[Bounds]) -> Option<bool> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::Graphics::Gdi::ScreenToClient;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let hwnd = window.hwnd().ok()?;
    let mut pt = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut pt) } == 0 {
        return None;
    }
    if unsafe { ScreenToClient(hwnd.0 as _, &mut pt) } == 0 {
        return None;
    }
    Some(point_in_holes(pt.x, pt.y, holes))
}

#[cfg(windows)]
fn apply_hit_test_once(window: &WebviewWindow, gen: u64, ignore: bool) -> bool {
    {
        let s = lock_state();
        if !s.click_through || s.hit_gen != gen {
            return false;
        }
    }
    set_click_through_now(window, ignore)
}

#[cfg(windows)]
fn hit_ignore_for(window: &WebviewWindow, holes: &[Bounds]) -> bool {
    if holes.is_empty() {
        return true;
    }
    !cursor_in_holes(window, holes).unwrap_or(false)
}

#[cfg(windows)]
fn hit_test_loop(window: WebviewWindow, token: u64) {
    let _slot = ThreadSlotGuard {
        slot: ThreadSlot::HitTest,
        token,
    };
    let mut last_ignore: Option<bool> = None;
    loop {
        let (holes, gen) = {
            let mut s = lock_state();
            let still_on = s.click_through;
            if !keep_running(&mut s, ThreadSlot::HitTest, token, still_on) {
                break;
            }
            (s.holes.clone(), s.hit_gen)
        };
        let ignore = hit_ignore_for(&window, &holes);
        if last_ignore != Some(ignore) && apply_hit_test_once(&window, gen, ignore) {
            last_ignore = Some(ignore);
        }
        thread::sleep(HIT_TEST_INTERVAL);
    }
}

#[cfg(windows)]
fn apply_topmost_once(window: &WebviewWindow) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        };

        {
            let s = lock_state();
            if !s.topmost_guard {
                return;
            }
        }
        let Some(_guard) = crate::try_lock_window_mutation() else {
            return;
        };
        let Ok(hwnd) = target.hwnd() else {
            return;
        };
        let _ = unsafe {
            SetWindowPos(
                hwnd.0 as _,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS,
            )
        };
    });
}

#[cfg(windows)]
fn topmost_loop(window: WebviewWindow, token: u64) {
    let _slot = ThreadSlotGuard {
        slot: ThreadSlot::Topmost,
        token,
    };
    loop {
        {
            let mut s = lock_state();
            let still_on = s.topmost_guard;
            if !keep_running(&mut s, ThreadSlot::Topmost, token, still_on) {
                break;
            }
        }
        apply_topmost_once(&window);
        remember_foreign_foreground();
        thread::sleep(TOPMOST_INTERVAL);
    }
}

pub(crate) fn show_no_activate(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, ShowWindow, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
            SWP_SHOWWINDOW, SW_SHOWNOACTIVATE,
        };

        let hwnd = window.hwnd().map_err(|e| {
            mark_win32_failed();
            e.to_string()
        })?;
        let _guard = crate::lock_window_mutation();
        unsafe { ShowWindow(hwnd.0 as _, SW_SHOWNOACTIVATE) };
        let ok = unsafe {
            SetWindowPos(
                hwnd.0 as _,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            )
        };
        if ok == 0 {
            mark_win32_failed();
            return Err("SetWindowPos failed".into());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        window.show().map_err(|e| e.to_string())
    }
}

/// Reaplica a preferência de "ocultar ao compartilhar tela" em todas as janelas.
///
/// O overlay de captura fica excluído sempre — ele só existe durante o recorte e
/// não pode aparecer dentro dele. Ponto único para o toggle e para o restore
/// pós-captura não divergirem sobre quais janelas contam.
pub(crate) fn apply_exclude_state(app: &AppHandle) {
    let enabled = lock_state().exclude_from_capture;
    for (label, window) in app.webview_windows() {
        let excluded = if label == OVERLAY_LABEL { true } else { enabled };
        crate::win_capture_flags::set_excluded_from_capture(&window, excluded);
    }
}

#[tauri::command]
pub fn show_window_no_activate(window: WebviewWindow) -> Result<(), String> {
    show_no_activate(&window)
}

#[tauri::command]
pub fn set_click_through(
    window: WebviewWindow,
    enabled: bool,
    holes: Vec<Bounds>,
) -> Result<OverlayChromeStatus, String> {
    #[cfg_attr(not(windows), allow(unused_variables))]
    let (gen, spawn) = {
        let mut s = lock_state();
        s.click_through = enabled;
        if enabled {
            s.holes = holes;
        } else {
            s.holes = Vec::new();
            s.hit_gen = s.hit_gen.wrapping_add(1);
        }
        let spawn = if enabled && cfg!(windows) {
            claim_thread(&mut s, ThreadSlot::HitTest)
        } else {
            None
        };
        (s.hit_gen, spawn)
    };

    #[cfg(windows)]
    {
        if enabled {
            let holes = lock_state().holes.clone();
            let ignore = hit_ignore_for(&window, &holes);
            let _ = apply_hit_test_once(&window, gen, ignore);
            if let Some(token) = spawn {
                let window = window.clone();
                thread::spawn(move || hit_test_loop(window, token));
            }
        } else {
            let _ = set_click_through_now(&window, false);
        }
    }

    #[cfg(not(windows))]
    {
        let _ = (gen, spawn);
        let _ = window.set_ignore_cursor_events(enabled);
    }

    Ok(snapshot())
}

#[tauri::command]
pub fn set_exclude_from_capture(
    app: AppHandle,
    enabled: bool,
) -> Result<OverlayChromeStatus, String> {
    {
        let mut s = lock_state();
        s.exclude_from_capture = enabled;
    }
    apply_exclude_state(&app);
    Ok(snapshot())
}

#[tauri::command]
pub fn set_topmost_guard(
    window: WebviewWindow,
    enabled: bool,
) -> Result<OverlayChromeStatus, String> {
    #[cfg_attr(not(windows), allow(unused_variables))]
    let spawn = {
        let mut s = lock_state();
        s.topmost_guard = enabled;
        if enabled && cfg!(windows) {
            claim_thread(&mut s, ThreadSlot::Topmost)
        } else {
            None
        }
    };

    #[cfg(windows)]
    {
        if enabled {
            apply_topmost_once(&window);
            if let Some(token) = spawn {
                let window = window.clone();
                thread::spawn(move || topmost_loop(window, token));
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = spawn;
        // Fora do Windows não existe guard: sem cair no always-on-top do Tauri a
        // ilha ficaria atrás do canal, já que o front parou de chamá-lo.
        let _ = window.set_always_on_top(enabled);
    }

    Ok(snapshot())
}

#[tauri::command]
pub fn overlay_chrome_status() -> OverlayChromeStatus {
    snapshot()
}

fn remember_foreign_foreground() {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowThreadProcessId,
        };

        let fg = unsafe { GetForegroundWindow() };
        if fg.is_null() {
            return;
        }
        let mut pid = 0u32;
        unsafe {
            GetWindowThreadProcessId(fg, &mut pid);
        }
        if pid == std::process::id() {
            return;
        }
        PREVIOUS_HWND.store(fg as isize, Ordering::Relaxed);
    }
}

#[tauri::command]
pub fn remember_previous_window() {
    remember_foreign_foreground();
}

#[tauri::command]
pub fn focus_previous_window() -> bool {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::HWND;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            AllowSetForegroundWindow, SetForegroundWindow,
        };

        let stored = PREVIOUS_HWND.load(Ordering::Relaxed);
        if stored == 0 {
            return false;
        }
        let hwnd = stored as HWND;
        unsafe {
            AllowSetForegroundWindow(u32::MAX);
            SetForegroundWindow(hwnd) != 0
        }
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::{claim_thread, keep_running, lock_state, point_in_holes, ThreadSlot};
    use crate::Bounds;

    #[test]
    fn point_in_holes_inside_inclusive_start() {
        let holes = [Bounds {
            x: 12,
            y: 8,
            width: 40,
            height: 24,
        }];
        assert!(point_in_holes(12, 8, &holes));
        assert!(point_in_holes(51, 31, &holes));
    }

    #[test]
    fn point_in_holes_exclusive_end() {
        let holes = [Bounds {
            x: 12,
            y: 8,
            width: 40,
            height: 24,
        }];
        assert!(!point_in_holes(52, 8, &holes));
        assert!(!point_in_holes(12, 32, &holes));
        assert!(!point_in_holes(11, 8, &holes));
        assert!(!point_in_holes(12, 7, &holes));
    }

    #[test]
    fn point_in_holes_empty_never_hits() {
        assert!(!point_in_holes(0, 0, &[]));
        assert!(!point_in_holes(12, 8, &[]));
    }

    #[test]
    fn claim_thread_is_exclusive_until_the_loop_releases() {
        let mut state = lock_state();
        state.hit_thread = 0;

        let first = claim_thread(&mut state, ThreadSlot::HitTest).expect("primeira vaga");
        assert!(claim_thread(&mut state, ThreadSlot::HitTest).is_none());

        assert!(!keep_running(&mut state, ThreadSlot::HitTest, first, false));
        let second = claim_thread(&mut state, ThreadSlot::HitTest).expect("vaga liberada");
        assert_ne!(first, second);

        // O loop antigo não pode roubar a vaga do sucessor ao terminar depois.
        assert!(!keep_running(&mut state, ThreadSlot::HitTest, first, false));
        assert_eq!(state.hit_thread, second);
        state.hit_thread = 0;
    }

    #[test]
    fn keep_running_holds_the_slot_while_enabled() {
        let mut state = lock_state();
        state.topmost_thread = 0;

        let token = claim_thread(&mut state, ThreadSlot::Topmost).expect("vaga");
        assert!(keep_running(&mut state, ThreadSlot::Topmost, token, true));
        assert_eq!(state.topmost_thread, token);
        state.topmost_thread = 0;
    }
}
