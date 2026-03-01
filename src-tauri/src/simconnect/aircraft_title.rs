use msfs::sim_connect::{Period, SimConnect, SimConnectRecv};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Global cache for the last known aircraft title.
static CACHED_TITLE: std::sync::LazyLock<Mutex<Option<String>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

/// Returns the last known aircraft title (if any).
pub fn get_cached_aircraft_title() -> Option<String> {
    CACHED_TITLE.lock().ok().and_then(|g| g.clone())
}

fn set_cached_title(title: &str) {
    if let Ok(mut g) = CACHED_TITLE.lock() {
        *g = Some(title.to_string());
    }
}

#[repr(C)]
#[derive(Debug, Clone)]
struct AircraftTitle {
    value: [u8; 256],
}

impl ::msfs::sim_connect::DataDefinition for AircraftTitle {
    const DEFINITIONS: &'static [(
        &'static str,
        &'static str,
        f32,
        ::msfs::sys::SIMCONNECT_DATATYPE,
    )] = &[(
        "TITLE",
        "",
        0.0,
        ::msfs::sys::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_STRING256,
    )];
}

pub fn start_aircraft_title_stream(app: AppHandle) {
    thread::spawn(move || loop {
        let app_cb = app.clone();
        let quit_flag = Arc::new(AtomicBool::new(false));
        let quit_flag_cb = quit_flag.clone();
        let _ = app.emit("simconnect-aircraft-title-status", "connecting");

        let mut sim = match SimConnect::open("Crewmate Aircraft Title", move |sim, recv| match recv
        {
            SimConnectRecv::SimObjectData(event) => match event.into::<AircraftTitle>(sim) {
                Some(title) => {
                    let bytes: Vec<u8> = title
                        .value
                        .iter()
                        .take_while(|&&b| b != 0)
                        .copied()
                        .collect();
                    let title_str = String::from_utf8_lossy(&bytes).trim().to_string();

                    if !title_str.is_empty() {
                        set_cached_title(&title_str);
                        let _ = app_cb.emit("simconnect-aircraft-title", title_str);
                    }
                }
                None => {
                    log::warn!("Aircraft title: received SimObjectData but failed to parse");
                }
            },
            SimConnectRecv::Quit(_) => {
                log::info!("Aircraft title: SimConnect Quit received, will reconnect");
                let _ = app_cb.emit("simconnect-aircraft-title-status", "disconnected");
                quit_flag_cb.store(true, Ordering::SeqCst);
            }
            SimConnectRecv::Exception(e) => {
                log::warn!("Aircraft title: SimConnect exception: {:?}", e);
            }
            _ => {}
        }) {
            Ok(s) => s,
            Err(e) => {
                log::warn!("Aircraft title stream unavailable: {:?}", e);
                let _ = app.emit(
                    "simconnect-aircraft-title-status",
                    format!("open_error:{:?}", e),
                );
                thread::sleep(Duration::from_secs(2));
                continue;
            }
        };

        if let Err(e) = sim.request_data_on_sim_object::<AircraftTitle>(
            2,
            ::msfs::sys::SIMCONNECT_OBJECT_ID_USER,
            Period::Second,
        ) {
            log::warn!("Failed to request aircraft title stream: {:?}", e);
            let _ = app.emit(
                "simconnect-aircraft-title-status",
                format!("request_error:{:?}", e),
            );
            thread::sleep(Duration::from_secs(2));
            continue;
        }

        let _ = app.emit("simconnect-aircraft-title-status", "streaming");
        log::info!("Aircraft title: streaming started");

        let mut heartbeat_ticks: u32 = 0;
        loop {
            if quit_flag.load(Ordering::SeqCst) {
                log::info!("Aircraft title: breaking dispatch loop (Quit received)");
                break;
            }

            if let Err(e) = sim.call_dispatch() {
                log::warn!("Aircraft title dispatch error: {:?}", e);
                let _ = app.emit(
                    "simconnect-aircraft-title-status",
                    format!("dispatch_error:{:?}", e),
                );
                break;
            }

            heartbeat_ticks = heartbeat_ticks.saturating_add(1);
            if heartbeat_ticks >= 20 {
                let _ = app.emit("simconnect-aircraft-title-status", "streaming");
                heartbeat_ticks = 0;
            }
            thread::sleep(Duration::from_millis(250));
        }

        // Drop the sim connection before sleeping to free the handle
        drop(sim);
        log::info!("Aircraft title: reconnecting in 2s...");
        thread::sleep(Duration::from_secs(2));
    });
}

#[tauri::command]
pub fn get_aircraft_title() -> Option<String> {
    get_cached_aircraft_title()
}
