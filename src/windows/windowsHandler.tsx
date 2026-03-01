import { invoke } from "@tauri-apps/api/core"

export const openTakeoffWindow = async () => {
  try {
    await invoke("open_takeoff_window")
  } catch (error) {
    console.error("Failed to open takeoff window:", error)
  }
}

export const openLandingWindow = async () => {
  try {
    await invoke("open_landing_window")
  } catch (error) {
    console.error("Failed to open landing window:", error)
  }
}

export const openSettingsWindow = async () => {
  try {
    await invoke("open_settings_window")
  } catch (error) {
    console.error("Failed to open settings window:", error)
  }
}
