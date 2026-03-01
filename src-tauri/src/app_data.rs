use tauri::AppHandle;
use tauri::Manager;

#[tauri::command]
pub fn setup_app_data_directories(app_handle: &tauri::AppHandle) -> tauri::Result<()> {
    // Get the app data directory
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        // Ensure the app data directory exists
        if !app_data_dir.exists() {
            std::fs::create_dir_all(&app_data_dir).map_err(tauri::Error::Io)?;
            log::info!("Created app data directory: {:?}", app_data_dir);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_log_file_path(app_handle: AppHandle) -> Result<String, String> {
    let logs_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("logs");

    let log_file_path = logs_dir.join("crewmateinia350.log");
    Ok(log_file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_logs_folder(app_handle: AppHandle) -> Result<(), String> {
    let logs_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("logs");

    // Create the directory if it doesn't exist
    std::fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;

    // Open the directory in the system file manager
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
