use crate::audio::audio_player::AudioPlayer;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub struct AudioPlayerState(pub AudioPlayer);

pub fn resolve_sound_path(
    app_handle: &AppHandle,
    pack: &str,
    filename: &str,
) -> Result<PathBuf, String> {
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let candidate = resource_dir.join("sounds").join(pack).join(filename);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    // Fallback to workspace paths during development
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let candidates = [
        cwd.join("sounds").join(pack).join(filename),
        cwd.join("src-tauri")
            .join("sounds")
            .join(pack)
            .join(filename),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Sound file not found for pack '{}' and filename '{}'",
        pack, filename
    ))
}

#[tauri::command]
pub async fn get_sound_packs(app_handle: AppHandle) -> Result<Vec<String>, String> {
    #[cfg(debug_assertions)]
    {
        let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
        let candidates = [
            cwd.join("sounds"),                   // If running from src-tauri
            cwd.join("src-tauri").join("sounds"), // If running from workspace root
        ];

        for dev_sounds in &candidates {
            log::info!("Dev mode - checking: {:?}", dev_sounds);
            if dev_sounds.exists() {
                return read_sound_packs(dev_sounds);
            }
        }
    }

    // Try resource dir (for packaged app)
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let sounds_dir = resource_dir.join("sounds");
        log::info!("Trying resource dir: {:?}", sounds_dir);
        if sounds_dir.exists() {
            return read_sound_packs(&sounds_dir);
        }
    }

    Err("Sounds directory not found".to_string())
}

pub fn read_sound_packs(sounds_dir: &PathBuf) -> Result<Vec<String>, String> {
    let mut packs = Vec::new();

    log::info!("Reading sound packs from: {:?}", sounds_dir);

    if let Ok(entries) = std::fs::read_dir(sounds_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        packs.push(name.to_string());
                    }
                }
            }
        }
    }

    packs.sort();
    log::info!("Available sound packs: {:?}", packs);
    Ok(packs)
}

#[tauri::command]
pub async fn play_sound(
    app_handle: AppHandle,
    audio_player: tauri::State<'_, AudioPlayerState>,
    pack: Option<String>,
    filename: String,
    volume: Option<f32>,
) -> Result<(), String> {
    let pack = pack.unwrap_or_else(|| "Jenny".to_string());
    let volume = volume.unwrap_or(1.0);
    let path = resolve_sound_path(&app_handle, &pack, &filename)?;

    audio_player
        .0
        .play_from_path(path, volume)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_audio_playing(audio_player: tauri::State<'_, AudioPlayerState>) -> bool {
    audio_player.0.is_playing()
}
