use crate::audio::audio_player::AudioPlayer;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub struct AudioPlayerState(pub AudioPlayer);

fn sounds_dir_candidates(app_handle: &AppHandle) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        dirs.push(cwd.join("sounds"));
        dirs.push(cwd.join("src-tauri").join("sounds"));
    }
    if let Ok(res) = app_handle.path().resource_dir() {
        dirs.push(res.join("sounds"));
    }
    dirs
}

pub fn resolve_sound_path(
    app_handle: &AppHandle,
    pack: &str,
    filename: &str,
) -> Result<PathBuf, String> {
    sounds_dir_candidates(app_handle)
        .into_iter()
        .map(|d| d.join(pack).join(filename))
        .find(|p| p.exists())
        .ok_or_else(|| {
            format!(
                "Sound file not found for pack '{}' and filename '{}'",
                pack, filename
            )
        })
}

#[tauri::command]
pub async fn get_sound_packs(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let sounds_dir = sounds_dir_candidates(&app_handle)
        .into_iter()
        .find(|d| d.exists())
        .ok_or("Sounds directory not found")?;

    let mut packs: Vec<String> = std::fs::read_dir(&sounds_dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| e.metadata().map(|m| m.is_dir()).unwrap_or(false))
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();

    packs.sort();
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
