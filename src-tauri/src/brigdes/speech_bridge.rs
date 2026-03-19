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
        // Resolve grammar.xml from the Tauri resource directory.
        // In dev mode this is src-tauri/bin/grammar.xml; in production it is the
        // bundled resource path — either way the sidecar receives an absolute path.
        let grammar_path = app_handle
            .path()
            .resource_dir()
            .expect("Failed to get resource dir")
            .join("bin")
            .join("grammar.xml");

        let (mut rx, child) = app_handle
            .shell()
            .sidecar("copilot_speech")
            .expect("Missing copilot_speech sidecar")
            .args([grammar_path.to_string_lossy().to_string()])
            .spawn()
            .expect("Failed to spawn speech recognition sidecar");

        let child = Arc::new(Mutex::new(Some(child)));
        let app_cb = app_handle.clone();

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
                                    log::error!("[Speech] Engine error: {}", value);
                                    let _ = app_cb.emit("speech_engine_error", value);
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
