use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

pub struct SpeechBridge {
    _handle: tauri::AppHandle,
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl SpeechBridge {
    /// Send a JSON config line to the sidecar via stdin.
    pub fn send_config(&self, json: &str) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(ref mut child) = *guard {
                let line = format!("{}\n", json);
                if let Err(e) = child.write(line.as_bytes()) {
                    eprintln!("[SPEECH] Failed to write to sidecar stdin: {:?}", e);
                }
            }
        }
    }
}

impl SpeechBridge {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        eprintln!("[SPEECH] Initializing speech recognition sidecar...");

        // Get the app data directory for storing models
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");

        // Try to load the selected model from settings
        let settings_file = app_data_dir.join("vosk_settings.json");
        let selected_model_id = if settings_file.exists() {
            std::fs::read_to_string(&settings_file)
                .ok()
                .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
                .and_then(|json| {
                    json.get("selected_model")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                })
        } else {
            None
        };

        // Get the model filename from the manager's configuration
        let model_filename =
            selected_model_id
                .as_ref()
                .and_then(|model_id| match model_id.as_str() {
                    "small-en-us" => Some("vosk-model-small-en-us-0.15"),
                    "large-en-us" => Some("vosk-model-en-us-0.22-lgraph"),
                    "big-en-us" => Some("vosk-model-en-us-0.22"),
                    _ => None,
                });

        // Try to find the model path
        let models_dir = app_data_dir.join("vosk-models");
        eprintln!("[SPEECH DEBUG] Looking for models in: {:?}", models_dir);
        eprintln!("[SPEECH DEBUG] Selected model ID: {:?}", selected_model_id);
        eprintln!("[SPEECH DEBUG] Model filename: {:?}", model_filename);

        let model_path = if let Some(filename) = model_filename {
            let path = models_dir.join(filename);
            if path.exists() && path.is_dir() {
                Some(path)
            } else {
                eprintln!("[SPEECH ERROR] Selected model not found: {:?}", path);
                None
            }
        } else if selected_model_id.is_some() {
            eprintln!("[SPEECH ERROR] Unknown model ID: {:?}", selected_model_id);
            None
        } else {
            // No selection, find any downloaded model
            if let Ok(entries) = std::fs::read_dir(&models_dir) {
                entries
                    .filter_map(|entry| entry.ok())
                    .find(|entry| {
                        entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false)
                            && entry
                                .file_name()
                                .to_string_lossy()
                                .starts_with("vosk-model")
                    })
                    .map(|entry| entry.path())
            } else {
                None
            }
        };

        let model_path = match model_path {
            Some(path) => {
                eprintln!("[SPEECH] Using model at: {:?}", path);
                path
            }
            None => {
                eprintln!("[SPEECH ERROR] No Vosk model found in: {:?}", models_dir);
                eprintln!("[SPEECH ERROR] Please download a model using the settings UI");
                eprintln!("[SPEECH DEBUG] Emitting vosk-no-model-found event...");

                // Emit event to notify the frontend
                if let Err(e) = app_handle.emit("vosk-no-model-found", ()) {
                    eprintln!("[SPEECH ERROR] Failed to emit event: {:?}", e);
                } else {
                    eprintln!("[SPEECH DEBUG] Event emitted successfully");
                }

                // Return early without spawning sidecar
                return Self {
                    _handle: app_handle,
                    child: Arc::new(Mutex::new(None)),
                };
            }
        };

        eprintln!("[SPEECH] Using model: {:?}", model_path);

        let sidecar_command = app_handle
            .shell()
            .sidecar("copilot_speech")
            .expect("Missing copilot_speech sidecar; place it under src-tauri/bin")
            .args([model_path.to_string_lossy().to_string()]);

        eprintln!("[SPEECH] Spawning speech sidecar process...");
        let (mut rx_child, child) = sidecar_command
            .spawn()
            .expect("Failed to spawn speech recognition sidecar");

        let child_handle = Arc::new(Mutex::new(Some(child)));
        eprintln!("[SPEECH] Speech sidecar spawned successfully, listening for events...");

        let app_clone = app_handle.clone();

        // Listen for speech events from the sidecar
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx_child.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        let line_str = String::from_utf8_lossy(&line);
                        eprintln!("[SPEECH STDOUT] {}", line_str);

                        // Parse JSON output from speech recognition
                        if let Ok(value) = serde_json::from_str::<Value>(&line_str) {
                            eprintln!("[SPEECH] Parsed JSON: {:?}", value);
                            if value.get("type") == Some(&Value::String("speech".into())) {
                                eprintln!("[SPEECH] Emitting speech_recognized event");
                                // Emit speech event to frontend
                                if let Err(e) = app_clone.emit("speech_recognized", value) {
                                    eprintln!("[SPEECH ERROR] Failed to emit event: {:?}", e);
                                }
                            }
                        } else {
                            eprintln!("[SPEECH] Failed to parse JSON from: {}", line_str);
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        let _line_str = String::from_utf8_lossy(&line);
                    }
                    CommandEvent::Error(err) => {
                        eprintln!("[SPEECH ERROR] Sidecar error: {}", err);
                    }
                    CommandEvent::Terminated(payload) => {
                        eprintln!("[SPEECH] Sidecar terminated: {:?}", payload);
                        break;
                    }
                    _ => {
                        eprintln!("[SPEECH] Unknown event type");
                    }
                }
            }
            eprintln!("[SPEECH] Event loop ended");
        });

        eprintln!("[SPEECH] Speech bridge initialized successfully");
        Self {
            _handle: app_handle,
            child: child_handle,
        }
    }
}

impl SpeechBridge {
    pub fn shutdown(&self) {
        eprintln!("[SPEECH] Shutting down speech bridge, killing sidecar process...");
        if let Ok(mut child_guard) = self.child.lock() {
            if let Some(child) = child_guard.take() {
                if let Err(e) = child.kill() {
                    eprintln!("[SPEECH ERROR] Failed to kill sidecar process: {:?}", e);
                } else {
                    eprintln!("[SPEECH] Sidecar process killed successfully");
                }
            } else {
                eprintln!("[SPEECH] No sidecar process to kill");
            }
        }
    }
}

impl Drop for SpeechBridge {
    fn drop(&mut self) {
        eprintln!("[SPEECH] SpeechBridge dropping, killing sidecar process...");
        if let Ok(mut child_guard) = self.child.lock() {
            if let Some(child) = child_guard.take() {
                if let Err(e) = child.kill() {
                    eprintln!("[SPEECH ERROR] Failed to kill sidecar process: {:?}", e);
                } else {
                    eprintln!("[SPEECH] Sidecar process killed successfully");
                }
            }
        }
    }
}
