use msfs::sim_connect::{Period, SimConnect, SimConnectRecv};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static CACHED_TITLE: std::sync::LazyLock<Mutex<Option<String>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

pub fn get_cached_aircraft_title() -> Option<String> {
    CACHED_TITLE.lock().ok().and_then(|g| g.clone())
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
        let quit = Arc::new(AtomicBool::new(false));
        let quit_cb = quit.clone();
        let app_cb = app.clone();

        let mut sim = match SimConnect::open("Crewmate Aircraft Title", move |sim, recv| match recv
        {
            SimConnectRecv::SimObjectData(e) => {
                if let Some(data) = e.into::<AircraftTitle>(sim) {
                    let title = String::from_utf8_lossy(&data.value)
                        .trim_matches(char::from(0))
                        .trim()
                        .to_string();
                    if !title.is_empty() {
                        if let Ok(mut g) = CACHED_TITLE.lock() {
                            *g = Some(title.clone());
                        }
                        let _ = app_cb.emit("simconnect-aircraft-title", title);
                    }
                }
            }
            SimConnectRecv::Quit(_) => quit_cb.store(true, Ordering::SeqCst),
            _ => {}
        }) {
            Ok(s) => s,
            Err(_) => {
                thread::sleep(Duration::from_secs(2));
                continue;
            }
        };

        if sim
            .request_data_on_sim_object::<AircraftTitle>(
                2,
                ::msfs::sys::SIMCONNECT_OBJECT_ID_USER,
                Period::Second,
            )
            .is_err()
        {
            thread::sleep(Duration::from_secs(2));
            continue;
        }

        while !quit.load(Ordering::SeqCst) {
            if sim.call_dispatch().is_err() {
                break;
            }
            thread::sleep(Duration::from_millis(250));
        }

        thread::sleep(Duration::from_secs(2));
    });
}

#[tauri::command]
pub fn get_aircraft_title() -> Option<String> {
    get_cached_aircraft_title()
}
