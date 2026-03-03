use super::mobiflight::MobiFlightVariableRequests;
use super::telemetry::TelemetryVariable;
use crate::{AppState, WorkerRequest};
use std::collections::HashMap;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::Emitter;

#[tauri::command]
pub fn mobiflight_set(
    state: tauri::State<'_, AppState>,
    variable_string: String,
) -> Result<(), String> {
    let (respond_tx, respond_rx) = mpsc::channel();
    let tx = state
        .inner()
        .tx
        .lock()
        .map_err(|_| "worker tx lock poisoned".to_string())?
        .clone();
    tx.send(WorkerRequest::Set {
        variable_string,
        respond_to: respond_tx,
    })
    .map_err(|e| e.to_string())?;
    respond_rx.recv().map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn mobiflight_get(
    state: tauri::State<'_, AppState>,
    variable_string: String,
) -> Result<Option<f32>, String> {
    let (respond_tx, respond_rx) = mpsc::channel();
    let tx = state
        .inner()
        .tx
        .lock()
        .map_err(|_| "worker tx lock poisoned".to_string())?
        .clone();
    tx.send(WorkerRequest::Get {
        variable_string,
        respond_to: respond_tx,
    })
    .map_err(|e| e.to_string())?;
    respond_rx.recv().map_err(|e| e.to_string())?
}

struct StreamState {
    variables: Vec<(String, String)>,
    app_handle: tauri::AppHandle,
    interval_ms: u64,
}

pub fn spawn_mobiflight_worker() -> mpsc::Sender<WorkerRequest> {
    let (tx, rx) = mpsc::channel::<WorkerRequest>();

    thread::spawn(move || {
        let mut client: Option<MobiFlightVariableRequests> = None;
        let mut stream: Option<StreamState> = None;

        loop {
            // Use the stream interval when streaming, otherwise 5ms idle tick
            let timeout = stream
                .as_ref()
                .map(|s| Duration::from_millis(s.interval_ms))
                .unwrap_or(Duration::from_millis(5));

            let recv_result = rx.recv_timeout(timeout);

            match recv_result {
                Ok(req) => match req {
                    WorkerRequest::Set {
                        variable_string,
                        respond_to,
                    } => {
                        let result = if let Some(c) = client.as_mut() {
                            c.set(&variable_string).map_err(|e| e.to_string())
                        } else {
                            Err("mobiflight is not connected".to_string())
                        };
                        let _ = respond_to.send(result);
                    }
                    WorkerRequest::Get {
                        variable_string,
                        respond_to,
                    } => {
                        let result = if let Some(c) = client.as_mut() {
                            c.get(&variable_string).map_err(|e| e.to_string())
                        } else {
                            Err("mobiflight is not connected".to_string())
                        };
                        let _ = respond_to.send(result);
                    }
                    WorkerRequest::StartStream {
                        variables,
                        interval_ms,
                        app_handle,
                        respond_to,
                    } => {
                        if client.is_none() {
                            match MobiFlightVariableRequests::new().and_then(|mut c| {
                                c.clear_sim_variables()?;
                                Ok(c)
                            }) {
                                Ok(c) => {
                                    client = Some(c);
                                }
                                Err(e) => {
                                    let _ = respond_to.send(Err(e.to_string()));
                                    continue;
                                }
                            }
                        } else if let Some(c) = client.as_mut() {
                            // Client already exists (stream restart after flight load) —
                            // clear slot table so LVARs re-register with correct indices.
                            let _ = c.clear_sim_variables();
                        }

                        // Seed all variables so MobiFlight WASM registers them
                        if let Some(c) = client.as_mut() {
                            for var in &variables {
                                let _ = c.get(&var.expression);
                            }
                        }

                        let var_pairs: Vec<(String, String)> = variables
                            .into_iter()
                            .map(|v| (v.key, v.expression))
                            .collect();

                        stream = Some(StreamState {
                            variables: var_pairs,
                            app_handle,
                            interval_ms,
                        });

                        let _ = respond_to.send(Ok(()));
                    }
                    WorkerRequest::StopStream(respond_to) => {
                        stream = None;
                        let _ = respond_to.send(Ok(()));
                    }
                },
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Idle tick — dispatch SimConnect messages and emit telemetry if streaming
                    if let Some(c) = client.as_mut() {
                        let _ = c.call_dispatch();

                        if let Some(ref s) = stream {
                            // Collect all current values in one pass
                            let mut values = HashMap::with_capacity(s.variables.len());
                            for (key, expr) in &s.variables {
                                let val = c.get_cached(expr).unwrap_or(0.0);
                                values.insert(key.clone(), val);
                            }

                            let _ = s.app_handle.emit("telemetry_data", &values);
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    tx
}

#[tauri::command]
pub fn start_telemetry_stream(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    variables: Vec<TelemetryVariable>,
    interval_ms: u64,
) -> Result<(), String> {
    let (respond_tx, respond_rx) = mpsc::channel();
    let tx = state
        .inner()
        .tx
        .lock()
        .map_err(|_| "worker tx lock poisoned".to_string())?
        .clone();
    tx.send(WorkerRequest::StartStream {
        variables,
        interval_ms,
        app_handle,
        respond_to: respond_tx,
    })
    .map_err(|e| e.to_string())?;
    respond_rx.recv().map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn stop_telemetry_stream(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let (respond_tx, respond_rx) = mpsc::channel();
    let tx = state
        .inner()
        .tx
        .lock()
        .map_err(|_| "worker tx lock poisoned".to_string())?
        .clone();
    tx.send(WorkerRequest::StopStream(respond_tx))
        .map_err(|e| e.to_string())?;
    respond_rx.recv().map_err(|e| e.to_string())?
}
