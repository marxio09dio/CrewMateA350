use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::time::sleep;

#[derive(Serialize, Deserialize, Clone)]
pub struct SpeechInputDevice {
    pub index: u32,
    pub name: String,
    pub is_default: bool,
}

pub struct SpeechBridge {
    handle: tauri::AppHandle,
    grammar_path: PathBuf,
    child: Arc<Mutex<Option<CommandChild>>>,
    last_error: Arc<Mutex<Option<String>>>,
    input_devices: Arc<Mutex<Vec<SpeechInputDevice>>>,
    selected_input_device: Arc<Mutex<Option<String>>>,
    is_shutting_down: Arc<AtomicBool>,
    active_instance_id: Arc<AtomicU64>,
}

impl SpeechBridge {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        // Resolve grammar.xml from the Tauri resource directory.
        // In dev mode this is src-tauri/bin/grammar.xml; in production it is the
        // bundled resource path — either way the sidecar receives an absolute path.
        let grammar_path = Self::resolve_grammar_path(&app_handle);

        let bridge = Self {
            handle: app_handle,
            grammar_path,
            child: Arc::new(Mutex::new(None)),
            last_error: Arc::new(Mutex::new(None)),
            input_devices: Arc::new(Mutex::new(Vec::new())),
            selected_input_device: Arc::new(Mutex::new(None)),
            is_shutting_down: Arc::new(AtomicBool::new(false)),
            active_instance_id: Arc::new(AtomicU64::new(0)),
        };

        if let Err(message) = bridge.spawn_sidecar(None) {
            bridge.record_error(&message);
            log::error!("[Speech] {}", message);
        }
        bridge
    }

    fn resolve_grammar_path(handle: &tauri::AppHandle) -> PathBuf {
        if let Ok(resource_dir) = handle.path().resource_dir() {
            return resource_dir.join("bin").join("grammar.xml");
        }
        log::warn!("[Speech] Resource dir unavailable, using fallback grammar path");
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|pp| pp.join("bin").join("grammar.xml")))
            .unwrap_or_else(|| PathBuf::from("bin").join("grammar.xml"))
    }

    fn record_error(&self, message: &str) {
        if let Ok(mut e) = self.last_error.lock() {
            *e = Some(message.to_string());
        }
        let _ = self.handle.emit(
            "speech_engine_error",
            serde_json::json!({ "type": "error", "message": message }),
        );
    }

    fn spawn_sidecar(&self, input_device: Option<&str>) -> Result<(), String> {
        let mut args = vec![self.grammar_path.to_string_lossy().to_string()];
        if let Some(device) = input_device {
            args.push(device.to_string());
        }

        let (mut rx, new_child) = self
            .handle
            .shell()
            .sidecar("copilot_speech")
            .map_err(|e| format!("Missing copilot_speech sidecar: {e}"))?
            .args(args)
            .spawn()
            .map_err(|e| format!("Failed to spawn speech recognition sidecar: {e}"))?;
        let instance_id = self.active_instance_id.fetch_add(1, Ordering::SeqCst) + 1;

        self.is_shutting_down.store(false, Ordering::SeqCst);
        if let Ok(mut d) = self.selected_input_device.lock() {
            *d = input_device
                .filter(|d| !d.is_empty() && *d != "default")
                .map(|s| s.to_string());
        }

        if let Ok(mut g) = self.child.lock() {
            *g = Some(new_child);
        }

        let last_error_cb = self.last_error.clone();
        let input_devices_cb = self.input_devices.clone();
        let app_cb = self.handle.clone();
        let child_cb = self.child.clone();
        let grammar_path_cb = self.grammar_path.clone();
        let selected_input_device_cb = self.selected_input_device.clone();
        let is_shutting_down_cb = self.is_shutting_down.clone();
        let active_instance_id_cb = self.active_instance_id.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        if let Ok(value) = serde_json::from_slice::<Value>(&line) {
                            match value["type"].as_str().unwrap_or("") {
                                "speech" => {
                                    log::info!(
                                        "[Speech] Recognized: \"{}\" (confidence: {:.2})",
                                        value["text"].as_str().unwrap_or("?"),
                                        value["confidence"].as_f64().unwrap_or(0.0)
                                    );
                                    let _ = app_cb.emit("speech_recognized", value);
                                }
                                "speech_unrecognized" => {
                                    log::debug!("[Speech] Unrecognized utterance");
                                    let _ = app_cb.emit("speech_recognized", value);
                                }
                                "status" => {
                                    log::info!("[Speech] Engine status: {}", value);
                                    let _ = app_cb.emit("speech_engine_status", value);
                                }
                                "error" => {
                                    let message = value["message"]
                                        .as_str()
                                        .unwrap_or("Unknown speech engine error")
                                        .to_string();
                                    if let Ok(mut e) = last_error_cb.lock() {
                                        *e = Some(message);
                                    }
                                    log::error!("[Speech] Engine error: {}", value);
                                    let _ = app_cb.emit("speech_engine_error", value);
                                }
                                "inputDevices" => {
                                    if let Some(arr) = value["devices"].as_array() {
                                        let devices: Vec<SpeechInputDevice> = arr
                                            .iter()
                                            .filter_map(|d| {
                                                let index = d["index"].as_u64()? as u32;
                                                let name = d["name"].as_str()?.to_string();
                                                let is_default =
                                                    d["isDefault"].as_bool().unwrap_or(false);
                                                Some(SpeechInputDevice {
                                                    index,
                                                    name,
                                                    is_default,
                                                })
                                            })
                                            .collect();

                                        if let Ok(mut stored) = input_devices_cb.lock() {
                                            *stored = devices;
                                        }
                                    }
                                }
                                _ => {}
                            }
                        } else {
                            log::warn!(
                                "[Speech] Non-JSON stdout: {}",
                                String::from_utf8_lossy(&line)
                            );
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        log::error!("[Speech] Stderr: {}", String::from_utf8_lossy(&line));
                    }
                    CommandEvent::Terminated(status) => {
                        log::error!("[Speech] Sidecar terminated: code={:?}", status.code);
                        let is_current_instance =
                            instance_id == active_instance_id_cb.load(Ordering::SeqCst);
                        if is_current_instance && !is_shutting_down_cb.load(Ordering::SeqCst) {
                            let selected =
                                selected_input_device_cb.lock().ok().and_then(|d| d.clone());
                            let _ = app_cb.emit(
                                "speech_engine_status",
                                serde_json::json!({
                                    "type": "status",
                                    "status": "restarting",
                                    "details": {
                                        "reason": "sidecar_terminated",
                                        "code": status.code,
                                    }
                                }),
                            );
                            SpeechBridge::schedule_restart(
                                app_cb.clone(),
                                grammar_path_cb.clone(),
                                child_cb.clone(),
                                last_error_cb.clone(),
                                input_devices_cb.clone(),
                                selected_input_device_cb.clone(),
                                is_shutting_down_cb.clone(),
                                active_instance_id_cb.clone(),
                                selected,
                                0,
                            );
                        }
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }

    fn schedule_restart(
        app_handle: tauri::AppHandle,
        grammar_path: PathBuf,
        child: Arc<Mutex<Option<CommandChild>>>,
        last_error: Arc<Mutex<Option<String>>>,
        input_devices: Arc<Mutex<Vec<SpeechInputDevice>>>,
        selected_input_device: Arc<Mutex<Option<String>>>,
        is_shutting_down: Arc<AtomicBool>,
        active_instance_id: Arc<AtomicU64>,
        input_device: Option<String>,
        attempt: u32,
    ) {
        const MAX_ATTEMPTS: u32 = 5;
        if attempt >= MAX_ATTEMPTS {
            let message = format!(
                "Speech engine failed to restart after {} attempts; please restart the app.",
                MAX_ATTEMPTS
            );
            if let Ok(mut e) = last_error.lock() {
                *e = Some(message.clone());
            }
            let _ = app_handle.emit(
                "speech_engine_error",
                serde_json::json!({ "type": "error", "message": message }),
            );
            return;
        }

        tauri::async_runtime::spawn(async move {
            let backoff_secs = 1u64 << attempt.min(4);
            sleep(Duration::from_secs(backoff_secs)).await;

            if is_shutting_down.load(Ordering::SeqCst) {
                return;
            }
            let expected_instance = active_instance_id.load(Ordering::SeqCst);

            let mut args = vec![grammar_path.to_string_lossy().to_string()];
            if let Some(device) = &input_device {
                args.push(device.clone());
            }

            let spawn_result = app_handle
                .shell()
                .sidecar("copilot_speech")
                .and_then(|cmd| cmd.args(args).spawn());

            match spawn_result {
                Ok((mut rx, new_child)) => {
                    // Ignore stale restart jobs scheduled by an old instance.
                    if expected_instance != active_instance_id.load(Ordering::SeqCst) {
                        let _ = new_child.kill();
                        return;
                    }
                    let instance_id = active_instance_id.fetch_add(1, Ordering::SeqCst) + 1;
                    is_shutting_down.store(false, Ordering::SeqCst);
                    if let Ok(mut c) = child.lock() {
                        *c = Some(new_child);
                    }
                    if let Ok(mut d) = selected_input_device.lock() {
                        *d = input_device.clone();
                    }
                    let _ = app_handle.emit(
                        "speech_engine_status",
                        serde_json::json!({
                            "type": "status",
                            "status": "ready",
                            "details": { "restarted": true }
                        }),
                    );

                    let last_error_cb = last_error.clone();
                    let input_devices_cb = input_devices.clone();
                    let app_cb = app_handle.clone();
                    let child_cb = child.clone();
                    let grammar_path_cb = grammar_path.clone();
                    let selected_input_device_cb = selected_input_device.clone();
                    let is_shutting_down_cb = is_shutting_down.clone();
                    let active_instance_id_cb = active_instance_id.clone();

                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => {
                                    if let Ok(value) = serde_json::from_slice::<Value>(&line) {
                                        match value["type"].as_str().unwrap_or("") {
                                            "speech" => {
                                                log::info!(
                                                    "[Speech] Recognized: \"{}\" (confidence: {:.2})",
                                                    value["text"].as_str().unwrap_or("?"),
                                                    value["confidence"].as_f64().unwrap_or(0.0)
                                                );
                                                let _ = app_cb.emit("speech_recognized", value);
                                            }
                                            "speech_unrecognized" => {
                                                log::debug!("[Speech] Unrecognized utterance");
                                                let _ = app_cb.emit("speech_recognized", value);
                                            }
                                            "status" => {
                                                log::info!("[Speech] Engine status: {}", value);
                                                let _ = app_cb.emit("speech_engine_status", value);
                                            }
                                            "error" => {
                                                let message = value["message"]
                                                    .as_str()
                                                    .unwrap_or("Unknown speech engine error")
                                                    .to_string();
                                                if let Ok(mut e) = last_error_cb.lock() {
                                                    *e = Some(message);
                                                }
                                                log::error!("[Speech] Engine error: {}", value);
                                                let _ = app_cb.emit("speech_engine_error", value);
                                            }
                                            "inputDevices" => {
                                                if let Some(arr) = value["devices"].as_array() {
                                                    let devices: Vec<SpeechInputDevice> = arr
                                                        .iter()
                                                        .filter_map(|d| {
                                                            let index = d["index"].as_u64()? as u32;
                                                            let name =
                                                                d["name"].as_str()?.to_string();
                                                            let is_default = d["isDefault"]
                                                                .as_bool()
                                                                .unwrap_or(false);
                                                            Some(SpeechInputDevice {
                                                                index,
                                                                name,
                                                                is_default,
                                                            })
                                                        })
                                                        .collect();

                                                    if let Ok(mut stored) = input_devices_cb.lock()
                                                    {
                                                        *stored = devices;
                                                    }
                                                }
                                            }
                                            _ => {}
                                        }
                                    } else {
                                        log::warn!(
                                            "[Speech] Non-JSON stdout: {}",
                                            String::from_utf8_lossy(&line)
                                        );
                                    }
                                }
                                CommandEvent::Stderr(line) => {
                                    log::error!(
                                        "[Speech] Stderr: {}",
                                        String::from_utf8_lossy(&line)
                                    );
                                }
                                CommandEvent::Terminated(status) => {
                                    log::error!(
                                        "[Speech] Sidecar terminated: code={:?}",
                                        status.code
                                    );
                                    let is_current_instance =
                                        instance_id == active_instance_id_cb.load(Ordering::SeqCst);
                                    if is_current_instance
                                        && !is_shutting_down_cb.load(Ordering::SeqCst)
                                    {
                                        let selected = selected_input_device_cb
                                            .lock()
                                            .ok()
                                            .and_then(|d| d.clone());
                                        SpeechBridge::schedule_restart(
                                            app_cb.clone(),
                                            grammar_path_cb.clone(),
                                            child_cb.clone(),
                                            last_error_cb.clone(),
                                            input_devices_cb.clone(),
                                            selected_input_device_cb.clone(),
                                            is_shutting_down_cb.clone(),
                                            active_instance_id_cb.clone(),
                                            selected,
                                            1,
                                        );
                                    }
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });
                }
                Err(e) => {
                    let message = format!(
                        "Speech sidecar restart attempt {} failed: {}",
                        attempt + 1,
                        e
                    );
                    if let Ok(mut err) = last_error.lock() {
                        *err = Some(message.clone());
                    }
                    let _ = app_handle.emit(
                        "speech_engine_error",
                        serde_json::json!({ "type": "error", "message": message }),
                    );
                    SpeechBridge::schedule_restart(
                        app_handle.clone(),
                        grammar_path.clone(),
                        child.clone(),
                        last_error.clone(),
                        input_devices.clone(),
                        selected_input_device.clone(),
                        is_shutting_down.clone(),
                        active_instance_id.clone(),
                        input_device.clone(),
                        attempt + 1,
                    );
                }
            }
        });
    }

    pub fn last_error(&self) -> Option<String> {
        self.last_error.lock().ok().and_then(|e| e.clone())
    }

    pub fn get_input_devices(&self) -> Vec<SpeechInputDevice> {
        self.input_devices
            .lock()
            .map(|g| g.clone())
            .unwrap_or_default()
    }

    pub fn send_config(&self, json: &str) {
        if let Ok(mut g) = self.child.lock() {
            if let Some(ref mut c) = *g {
                let _ = c.write(format!("{}\n", json).as_bytes());
            }
        }
    }

    /// Kill the current sidecar and respawn it with the given input device name.
    /// Pass `None` (or `Some("default")`) to fall back to the system default mic.
    pub fn restart_with_device(&self, device: Option<String>) {
        log::info!(
            "[Speech] Restarting sidecar with input device: {:?}",
            device
        );
        if let Ok(mut d) = self.input_devices.lock() {
            d.clear();
        }
        self.shutdown();
        let arg = device.filter(|d| !d.is_empty() && d != "default");
        if let Err(message) = self.spawn_sidecar(arg.as_deref()) {
            self.record_error(&message);
            log::error!("[Speech] {}", message);
        }
    }

    pub fn shutdown(&self) {
        self.is_shutting_down.store(true, Ordering::SeqCst);
        // Invalidate currently tracked instance so stale termination events
        // cannot trigger a second spawn.
        self.active_instance_id.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut g) = self.child.lock() {
            if let Some(c) = g.take() {
                let _ = c.kill();
            }
        }
    }
}

impl Drop for SpeechBridge {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[tauri::command]
pub fn get_speech_input_devices(
    state: tauri::State<'_, crate::SpeechBridgeState>,
) -> Vec<SpeechInputDevice> {
    state.0.get_input_devices()
}
