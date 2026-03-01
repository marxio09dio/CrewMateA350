pub mod vosk_commands;

use anyhow::Result;
use futures_util::StreamExt;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoskModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_mb: u64,
    pub url: String,
    pub filename: String,
    pub is_downloaded: bool,
    pub is_downloading: bool,
    pub partial_size: u64,
    pub languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoskDownloadProgress {
    pub model_id: String,
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
}

pub struct VoskModelManager {
    app_handle: AppHandle,
    models_dir: PathBuf,
    available_models: Arc<tokio::sync::Mutex<HashMap<String, VoskModelInfo>>>,
}

impl VoskModelManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        let models_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow::anyhow!("Failed to get app data dir: {}", e))?
            .join("vosk-models");

        if !models_dir.exists() {
            fs::create_dir_all(&models_dir)?;
        }

        let mut available_models = HashMap::new();

        // Small English model - Fast and lightweight
        available_models.insert(
            "small-en-us".to_string(),
            VoskModelInfo {
                id: "small-en-us".to_string(),
                name: "Small English (US)".to_string(),
                description: "Lightweight model, fast recognition, good for basic commands"
                    .to_string(),
                size_mb: 40,
                url: "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
                    .to_string(),
                filename: "vosk-model-small-en-us-0.15".to_string(),
                is_downloaded: false,
                is_downloading: false,
                partial_size: 0,
                languages: vec!["en-US".to_string()],
            },
        );

        // Large English model - Accurate
        available_models.insert(
            "large-en-us".to_string(),
            VoskModelInfo {
                id: "large-en-us".to_string(),
                name: "Large English (US)".to_string(),
                description: "High accuracy model with large vocabulary, better for complex speech"
                    .to_string(),
                size_mb: 128,
                url: "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip"
                    .to_string(),
                filename: "vosk-model-en-us-0.22-lgraph".to_string(),
                is_downloaded: false,
                is_downloading: false,
                partial_size: 0,
                languages: vec!["en-US".to_string()],
            },
        );

        // Big English model - Most accurate, but very large
        available_models.insert(
            "big-en-us".to_string(),
            VoskModelInfo {
                id: "big-en-us".to_string(),
                name: "Accurate English (US)".to_string(),
                description: "Most accurate model with large vocabulary and better noise robustness, but larger file size"
                    .to_string(),
                size_mb: 1800,
                url: "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip"
                    .to_string(),
                filename: "vosk-model-en-us-0.22".to_string(),
                is_downloaded: false,
                is_downloading: false,
                partial_size: 0,
                languages: vec!["en-US".to_string()],
            },
        );

        let manager = Self {
            app_handle: app_handle.clone(),
            models_dir,
            available_models: Arc::new(tokio::sync::Mutex::new(available_models)),
        };

        // Note: update_download_status will be called on first access
        // to avoid blocking during initialization

        Ok(manager)
    }

    pub async fn get_available_models(&self) -> Vec<VoskModelInfo> {
        // Update status before returning to ensure freshness
        let _ = self.update_download_status().await;
        let models = self.available_models.lock().await;
        models.values().cloned().collect()
    }

    pub async fn get_model_info(&self, model_id: &str) -> Option<VoskModelInfo> {
        let models = self.available_models.lock().await;
        models.get(model_id).cloned()
    }

    async fn update_download_status(&self) -> Result<()> {
        let mut models = self.available_models.lock().await;

        for model in models.values_mut() {
            let model_path = self.models_dir.join(&model.filename);
            let partial_path = self
                .models_dir
                .join(format!("{}.zip.partial", &model.filename));

            model.is_downloaded = model_path.exists() && model_path.is_dir();
            model.is_downloading = false;

            if partial_path.exists() {
                model.partial_size = partial_path.metadata().map(|m| m.len()).unwrap_or(0);
            } else {
                model.partial_size = 0;
            }
        }

        Ok(())
    }

    pub async fn download_model(&self, model_id: &str) -> Result<()> {
        let model_info = {
            let models = self.available_models.lock().await;
            models.get(model_id).cloned()
        };

        let model_info =
            model_info.ok_or_else(|| anyhow::anyhow!("Model not found: {}", model_id))?;

        let model_path = self.models_dir.join(&model_info.filename);
        let partial_path = self
            .models_dir
            .join(format!("{}.zip.partial", &model_info.filename));

        // Don't download if already exists
        if model_path.exists() {
            if partial_path.exists() {
                let _ = fs::remove_file(&partial_path);
            }
            self.update_download_status().await?;
            return Ok(());
        }

        let mut resume_from = if partial_path.exists() {
            let size = partial_path.metadata()?.len();
            info!(
                "Resuming download of Vosk model {} from byte {}",
                model_id, size
            );
            size
        } else {
            info!(
                "Starting download of Vosk model {} from {}",
                model_id, model_info.url
            );
            0
        };

        // Mark as downloading
        {
            let mut models = self.available_models.lock().await;
            if let Some(model) = models.get_mut(model_id) {
                model.is_downloading = true;
            }
        }

        let client = reqwest::Client::new();
        let mut request = client.get(&model_info.url);

        if resume_from > 0 {
            request = request.header("Range", format!("bytes={}-", resume_from));
        }

        let mut response = request.send().await?;

        // Handle servers that don't support range requests
        if resume_from > 0 && response.status() == reqwest::StatusCode::OK {
            warn!("Server doesn't support range requests, restarting download");
            drop(response);
            let _ = fs::remove_file(&partial_path);
            resume_from = 0;
            response = client.get(&model_info.url).send().await?;
        }

        if !response.status().is_success()
            && response.status() != reqwest::StatusCode::PARTIAL_CONTENT
        {
            let mut models = self.available_models.lock().await;
            if let Some(model) = models.get_mut(model_id) {
                model.is_downloading = false;
            }
            return Err(anyhow::anyhow!(
                "Failed to download model: HTTP {}",
                response.status()
            ));
        }

        let total_size = if resume_from > 0 {
            resume_from + response.content_length().unwrap_or(0)
        } else {
            response.content_length().unwrap_or(0)
        };

        let mut downloaded = resume_from;
        let mut stream = response.bytes_stream();

        let mut file = if resume_from > 0 {
            std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&partial_path)?
        } else {
            std::fs::File::create(&partial_path)?
        };

        // Emit initial progress
        let initial_progress = VoskDownloadProgress {
            model_id: model_id.to_string(),
            downloaded,
            total: total_size,
            percentage: if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else {
                0.0
            },
        };
        let _ = self
            .app_handle
            .emit("vosk-model-download-progress", &initial_progress);

        // Download with progress
        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    let mut models = self.available_models.lock().await;
                    if let Some(model) = models.get_mut(model_id) {
                        model.is_downloading = false;
                    }
                    return Err(e.into());
                }
            };

            file.write_all(&chunk)?;
            downloaded += chunk.len() as u64;

            let percentage = if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else {
                0.0
            };

            let progress = VoskDownloadProgress {
                model_id: model_id.to_string(),
                downloaded,
                total: total_size,
                percentage,
            };

            let _ = self
                .app_handle
                .emit("vosk-model-download-progress", &progress);
        }

        file.flush()?;
        drop(file);

        // Verify file size
        if total_size > 0 {
            let actual_size = partial_path.metadata()?.len();
            if actual_size != total_size {
                let _ = fs::remove_file(&partial_path);
                let mut models = self.available_models.lock().await;
                if let Some(model) = models.get_mut(model_id) {
                    model.is_downloading = false;
                }
                return Err(anyhow::anyhow!(
                    "Download incomplete: expected {} bytes, got {} bytes",
                    total_size,
                    actual_size
                ));
            }
        }

        // Extract the ZIP file
        let _ = self
            .app_handle
            .emit("vosk-model-extraction-started", model_id);
        info!("Extracting Vosk model archive: {}", model_id);

        let temp_extract_dir = self
            .models_dir
            .join(format!("{}.extracting", &model_info.filename));

        if temp_extract_dir.exists() {
            let _ = fs::remove_dir_all(&temp_extract_dir);
        }

        fs::create_dir_all(&temp_extract_dir)?;

        let zip_file = File::open(&partial_path)?;
        let mut archive = zip::ZipArchive::new(zip_file)?;

        archive.extract(&temp_extract_dir).map_err(|e| {
            let error_msg = format!("Failed to extract archive: {}", e);
            let _ = fs::remove_dir_all(&temp_extract_dir);
            let _ = self.app_handle.emit(
                "vosk-model-extraction-failed",
                &serde_json::json!({
                    "model_id": model_id,
                    "error": error_msg
                }),
            );
            anyhow::anyhow!(error_msg)
        })?;

        // Find the extracted directory
        let extracted_dirs: Vec<_> = fs::read_dir(&temp_extract_dir)?
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false))
            .collect();

        if extracted_dirs.len() == 1 {
            let source_dir = extracted_dirs[0].path();
            if model_path.exists() {
                fs::remove_dir_all(&model_path)?;
            }
            fs::rename(&source_dir, &model_path)?;
            let _ = fs::remove_dir_all(&temp_extract_dir);
        } else {
            if model_path.exists() {
                fs::remove_dir_all(&model_path)?;
            }
            fs::rename(&temp_extract_dir, &model_path)?;
        }

        info!("Successfully extracted Vosk model: {}", model_id);
        let _ = self
            .app_handle
            .emit("vosk-model-extraction-completed", model_id);

        // Remove the downloaded ZIP file
        let _ = fs::remove_file(&partial_path);

        // Update status
        {
            let mut models = self.available_models.lock().await;
            if let Some(model) = models.get_mut(model_id) {
                model.is_downloading = false;
                model.is_downloaded = true;
                model.partial_size = 0;
            }
        }

        let _ = self
            .app_handle
            .emit("vosk-model-download-complete", model_id);

        info!(
            "Successfully downloaded Vosk model {} to {:?}",
            model_id, model_path
        );

        Ok(())
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<()> {
        let model_info = {
            let models = self.available_models.lock().await;
            models.get(model_id).cloned()
        };

        let model_info =
            model_info.ok_or_else(|| anyhow::anyhow!("Model not found: {}", model_id))?;

        let model_path = self.models_dir.join(&model_info.filename);
        let partial_path = self
            .models_dir
            .join(format!("{}.zip.partial", &model_info.filename));

        let mut deleted_something = false;

        if model_path.exists() && model_path.is_dir() {
            info!("Deleting Vosk model directory at: {:?}", model_path);
            fs::remove_dir_all(&model_path)?;
            deleted_something = true;
        }

        if partial_path.exists() {
            info!("Deleting partial file at: {:?}", partial_path);
            fs::remove_file(&partial_path)?;
            deleted_something = true;
        }

        if !deleted_something {
            return Err(anyhow::anyhow!("No model files found to delete"));
        }

        self.update_download_status().await?;

        Ok(())
    }

    pub async fn get_model_path(&self, model_id: &str) -> Result<PathBuf> {
        let model_info = self
            .get_model_info(model_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Model not found: {}", model_id))?;

        if !model_info.is_downloaded {
            return Err(anyhow::anyhow!("Model not downloaded: {}", model_id));
        }

        if model_info.is_downloading {
            return Err(anyhow::anyhow!(
                "Model is currently downloading: {}",
                model_id
            ));
        }

        let model_path = self.models_dir.join(&model_info.filename);

        if model_path.exists() && model_path.is_dir() {
            Ok(model_path)
        } else {
            Err(anyhow::anyhow!(
                "Complete model directory not found: {}",
                model_id
            ))
        }
    }
}
