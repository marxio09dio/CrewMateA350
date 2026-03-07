use msfs::sim_connect::{Period, SimConnect, SimConnectRecv};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static IN_COCKPIT: AtomicBool = AtomicBool::new(false);

/// Returns whether the cockpit has been detected in the current session.
pub fn is_in_cockpit() -> bool {
    IN_COCKPIT.load(Ordering::Relaxed)
}

#[repr(C)]
#[derive(Debug, Clone)]
struct CameraState {
    value: f64,
}

impl ::msfs::sim_connect::DataDefinition for CameraState {
    const DEFINITIONS: &'static [(
        &'static str,
        &'static str,
        f32,
        ::msfs::sys::SIMCONNECT_DATATYPE,
    )] = &[(
        "CAMERA STATE",
        "Number",
        -1.0,
        ::msfs::sys::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
    )];
}

/// Polls CAMERA STATE once per second until the user enters the cockpit (value < 11),
/// then emits `"sim-in-flight"=true` once and exits. Pausing mid-flight has no effect.
pub fn start_flight_state_stream(app: AppHandle) {
    thread::spawn(move || loop {
        let cockpit_detected = Arc::new(AtomicBool::new(false));
        let quit = Arc::new(AtomicBool::new(false));
        let detected_cb = cockpit_detected.clone();
        let quit_cb = quit.clone();
        let app_cb = app.clone();

        let mut sim = match SimConnect::open("Crewmate Flight State", move |sim, recv| match recv {
            SimConnectRecv::SimObjectData(e) => {
                if let Some(data) = e.into::<CameraState>(sim) {
                    if (data.value as u32) < 11 && !detected_cb.swap(true, Ordering::SeqCst) {
                        IN_COCKPIT.store(true, Ordering::Relaxed);
                        // Delay the emit by 300 ms so the frontend listener has time to
                        // register before the event fires, avoiding the missed-event race.
                        let app_for_emit = app_cb.clone();
                        thread::spawn(move || {
                            thread::sleep(Duration::from_millis(300));
                            let _ = app_for_emit.emit("sim-in-flight", true);
                        });
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
            .request_data_on_sim_object::<CameraState>(
                3,
                ::msfs::sys::SIMCONNECT_OBJECT_ID_USER,
                Period::Second,
            )
            .is_err()
        {
            thread::sleep(Duration::from_secs(2));
            continue;
        }

        while !cockpit_detected.load(Ordering::SeqCst) && !quit.load(Ordering::SeqCst) {
            if sim.call_dispatch().is_err() {
                break;
            }
            thread::sleep(Duration::from_millis(250));
        }

        if cockpit_detected.load(Ordering::SeqCst) {
            return;
        } // cockpit detected — thread done
        thread::sleep(Duration::from_secs(2)); // sim closed before cockpit — retry
    });
}
