use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

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
}

impl SpeechBridge {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        // Resolve grammar.xml from the Tauri resource directory.
        // In dev mode this is src-tauri/bin/grammar.xml; in production it is the
        // bundled resource path — either way the sidecar receives an absolute path.
        let grammar_path = app_handle
            .path()
            .resource_dir()
            .expect("Failed to get resource dir")
            .join("bin")
            .join("grammar.xml");

        let bridge = Self {
            handle: app_handle,
            grammar_path,
            child: Arc::new(Mutex::new(None)),
            last_error: Arc::new(Mutex::new(None)),
            input_devices: Arc::new(Mutex::new(Vec::new())),
        };

        bridge.spawn_sidecar(None);
        bridge
    }

    fn spawn_sidecar(&self, input_device: Option<&str>) {
        let mut args = vec![self.grammar_path.to_string_lossy().to_string()];
        if let Some(device) = input_device {
            args.push(device.to_string());
        }

        let (mut rx, new_child) = self
            .handle
            .shell()
            .sidecar("copilot_speech")
            .expect("Missing copilot_speech sidecar")
            .args(args)
            .spawn()
            .expect("Failed to spawn speech recognition sidecar");

        if let Ok(mut g) = self.child.lock() {
            *g = Some(new_child);
        }

        let last_error_cb = self.last_error.clone();
        let input_devices_cb = self.input_devices.clone();
        let app_cb = self.handle.clone();

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
                        break;
                    }
                    _ => {}
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
        self.spawn_sidecar(arg.as_deref());
    }

    pub fn shutdown(&self) {
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
