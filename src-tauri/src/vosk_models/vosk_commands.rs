use crate::vosk_models::VoskModelManager;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

pub struct VoskModelManagerState(pub Arc<tokio::sync::Mutex<VoskModelManager>>);

#[tauri::command]
pub async fn get_voice_model_info(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let models_dir = app_data_dir.join("vosk-models");
    let model_path = models_dir.join("vosk-model-en-us-0.22-lgraph");

    let model_exists = model_path.exists();
    let model_path_str = model_path.to_string_lossy().to_string();

    Ok(serde_json::json!({
        "exists": model_exists,
        "path": model_path_str,
        "modelsDir": models_dir.to_string_lossy().to_string()
    }))
}

#[tauri::command]
pub async fn open_voice_models_folder(app_handle: AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let models_dir = app_data_dir.join("vosk-models");

    // Create the directory if it doesn't exist
    std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;

    // Open the directory in the system file manager
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&models_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_vosk_models(
    model_manager: tauri::State<'_, VoskModelManagerState>,
) -> Result<Vec<crate::vosk_models::VoskModelInfo>, String> {
    let manager = model_manager.0.lock().await;
    Ok(manager.get_available_models().await)
}

#[tauri::command]
pub async fn download_vosk_model(
    model_manager: tauri::State<'_, VoskModelManagerState>,
    model_id: String,
) -> Result<(), String> {
    let manager = model_manager.0.lock().await;
    manager
        .download_model(&model_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_vosk_model(
    app_handle: AppHandle,
    model_manager: tauri::State<'_, VoskModelManagerState>,
    model_id: String,
) -> Result<(), String> {
    let manager = model_manager.0.lock().await;
    manager
        .delete_model(&model_id)
        .await
        .map_err(|e| e.to_string())?;

    drop(manager);

    // Check if the deleted model was the selected one
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let settings_file = app_data_dir.join("vosk_settings.json");

    if settings_file.exists() {
        if let Ok(content) = std::fs::read_to_string(&settings_file) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(selected) = json.get("selected_model").and_then(|v| v.as_str()) {
                    if selected == model_id {
                        // Clear the selection since we deleted the selected model
                        let _ = std::fs::remove_file(&settings_file);
                    }
                }
            }
        }
    }

    // Check if there are any models left
    let models_dir = app_data_dir.join("vosk-models");
    let has_models = if models_dir.exists() {
        std::fs::read_dir(&models_dir)
            .map(|entries| {
                entries.filter_map(|entry| entry.ok()).any(|entry| {
                    entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false)
                        && entry
                            .file_name()
                            .to_string_lossy()
                            .starts_with("vosk-model")
                })
            })
            .unwrap_or(false)
    } else {
        false
    };

    // If no models left, emit event to update UI
    if !has_models {
        let _ = app_handle.emit("vosk-all-models-deleted", ());
    } else {
        // Just emit a general update event
        let _ = app_handle.emit("vosk-model-deleted", ());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_vosk_model_path(
    model_manager: tauri::State<'_, VoskModelManagerState>,
    model_id: String,
) -> Result<String, String> {
    let manager = model_manager.0.lock().await;
    let path = manager
        .get_model_path(&model_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_selected_vosk_model(app_handle: AppHandle) -> Result<Option<String>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let settings_file = app_data_dir.join("vosk_settings.json");

    if !settings_file.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&settings_file).map_err(|e| e.to_string())?;
    let settings: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    Ok(settings
        .get("selected_model")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

#[tauri::command]
pub async fn set_selected_vosk_model(
    app_handle: AppHandle,
    model_id: String,
) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

    let settings_file = app_data_dir.join("vosk_settings.json");

    let settings = serde_json::json!({
        "selected_model": model_id
    });

    std::fs::write(
        &settings_file,
        serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    // Emit event to notify frontend that selection changed
    let _ = app_handle.emit("vosk-model-selected", ());

    Ok(())
}

#[tauri::command]
pub async fn check_vosk_model_status(app_handle: AppHandle) -> Result<bool, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let models_dir = app_data_dir.join("vosk-models");

    // Check if any model directory exists
    if !models_dir.exists() {
        return Ok(false);
    }

    let has_model = std::fs::read_dir(&models_dir)
        .map(|entries| {
            entries.filter_map(|entry| entry.ok()).any(|entry| {
                entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false)
                    && entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with("vosk-model")
            })
        })
        .unwrap_or(false);

    Ok(has_model)
}
