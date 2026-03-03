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
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");
        let models_dir = app_data_dir.join("vosk-models");

        // Resolve selected model ID from settings file
        let selected_id = app_data_dir
            .join("vosk_settings.json")
            .exists()
            .then(|| std::fs::read_to_string(app_data_dir.join("vosk_settings.json")).ok())
            .flatten()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .and_then(|v| v["selected_model"].as_str().map(String::from));

        // Map model ID → folder name, then verify it exists
        let model_path = selected_id
            .as_deref()
            .and_then(|id| match id {
                "small-en-us" => Some("vosk-model-small-en-us-0.15"),
                "large-en-us" => Some("vosk-model-en-us-0.22-lgraph"),
                "big-en-us" => Some("vosk-model-en-us-0.22"),
                _ => None,
            })
            .map(|name| models_dir.join(name))
            .filter(|p| p.is_dir())
            // Fall back to any downloaded vosk-model directory
            .or_else(|| {
                std::fs::read_dir(&models_dir)
                    .ok()?
                    .flatten()
                    .find(|e| {
                        e.file_type().map(|t| t.is_dir()).unwrap_or(false)
                            && e.file_name().to_string_lossy().starts_with("vosk-model")
                    })
                    .map(|e| e.path())
            });

        let Some(model_path) = model_path else {
            let _ = app_handle.emit("vosk-no-model-found", ());
            return Self {
                _handle: app_handle,
                child: Arc::new(Mutex::new(None)),
            };
        };

        let (mut rx, child) = app_handle
            .shell()
            .sidecar("copilot_speech")
            .expect("Missing copilot_speech sidecar")
            .args([model_path.to_string_lossy().to_string()])
            .spawn()
            .expect("Failed to spawn speech recognition sidecar");

        let child = Arc::new(Mutex::new(Some(child)));
        let app_cb = app_handle.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        if let Ok(value) = serde_json::from_slice::<Value>(&line) {
                            if value["type"] == "speech" {
                                println!("[Speech] Recognized: {}", value);
                                let _ = app_cb.emit("speech_recognized", value);
                            }
                        }
                    }
                    CommandEvent::Terminated(_) => break,
                    _ => {}
                }
            }
        });

        Self {
            _handle: app_handle,
            child,
        }
    }

    pub fn send_config(&self, json: &str) {
        if let Ok(mut g) = self.child.lock() {
            if let Some(ref mut c) = *g {
                let _ = c.write(format!("{}\n", json).as_bytes());
            }
        }
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
