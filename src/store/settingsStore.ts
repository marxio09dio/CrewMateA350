import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type LightsControlMode = "virtual" | "user"

const defaultLightsControlMode: LightsControlMode = "user"

interface SettingsStore {
  voiceEnabled: boolean
  voiceMode: "continuous" | "ptt"
  pttShortcut: string
  soundPack: string
  soundVolume: number
  outputDevice?: string | null
  inputDevice?: string | null
  lightsControlMode: LightsControlMode
  confidenceThreshold: number
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceMode: (mode: "continuous" | "ptt") => void
  setPttShortcut: (shortcut: string) => void
  setSoundPack: (pack: string) => void
  setSoundVolume: (volume: number) => void
  setOutputDevice: (device: string | null) => void
  setInputDevice: (device: string | null) => void
  setLightsControlMode: (mode: LightsControlMode) => void
  setConfidenceThreshold: (threshold: number) => void
}

let isUpdatingFromEvent = false

const normalizeThreshold = (threshold: number) => Math.min(100, Math.max(0, threshold))
const toEngineThreshold = (threshold: number) => normalizeThreshold(threshold) / 100

const applyConfidenceThreshold = async (threshold: number) => {
  await invoke("set_confidence_threshold", { threshold: toEngineThreshold(threshold) })
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      voiceEnabled: false,
      voiceMode: "continuous",
      pttShortcut: "CmdOrCtrl+Shift+Space",
      soundPack: "Jenny",
      soundVolume: 100,
      outputDevice: null,
      inputDevice: null,
      lightsControlMode: defaultLightsControlMode,
      confidenceThreshold: 85,

      setVoiceEnabled: (enabled) => {
        set({ voiceEnabled: enabled })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { voiceEnabled: enabled })
        }
      },
      setVoiceMode: (mode) => {
        set({ voiceMode: mode })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { voiceMode: mode })
        }
      },
      setPttShortcut: (shortcut) => {
        set({ pttShortcut: shortcut })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { pttShortcut: shortcut })
        }
      },
      setSoundPack: (pack) => {
        set({ soundPack: pack })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { soundPack: pack })
        }
      },
      setSoundVolume: (volume) => {
        set({ soundVolume: volume })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { soundVolume: volume })
        }
      },
      setOutputDevice: (device) => {
        set({ outputDevice: device })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { outputDevice: device })
        }
      },
      setInputDevice: (device) => {
        set({ inputDevice: device })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { inputDevice: device })
        }
      },
      setLightsControlMode: (mode) => {
        set({ lightsControlMode: mode })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { lightsControlMode: mode })
        }
      },
      setConfidenceThreshold: (threshold) => {
        const safeThreshold = normalizeThreshold(threshold)
        set({ confidenceThreshold: safeThreshold })
        applyConfidenceThreshold(safeThreshold).catch((err) => {
          console.error("Failed to apply confidence threshold:", err)
        })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { confidenceThreshold: safeThreshold })
        }
      }
    }),
    {
      name: "voice-settings",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const safeThreshold = normalizeThreshold(state.confidenceThreshold)
          if (safeThreshold !== state.confidenceThreshold) {
            useSettingsStore.setState({ confidenceThreshold: safeThreshold })
          }
          applyConfidenceThreshold(safeThreshold).catch((err) => {
            console.error("Failed to restore confidence threshold:", err)
          })
        }
        if (state && state.outputDevice) {
          invoke("set_output_device", { device: state.outputDevice }).catch(() => {})
        }
        if (state && state.inputDevice) {
          invoke("set_input_device", { device: state.inputDevice }).catch(() => {})
        }
      }
    }
  )
)

listen<
  Partial<
    Omit<
      SettingsStore,
      | "setVoiceEnabled"
      | "setVoiceMode"
      | "setPttShortcut"
      | "setSoundPack"
      | "setSoundVolume"
      | "setLightsControlMode"
      | "setConfidenceThreshold"
    >
  >
>("settings-changed", (event) => {
  isUpdatingFromEvent = true

  if (event.payload.voiceEnabled !== undefined) {
    useSettingsStore.setState({ voiceEnabled: event.payload.voiceEnabled })
  }
  if (event.payload.voiceMode !== undefined) {
    useSettingsStore.setState({ voiceMode: event.payload.voiceMode })
  }
  if (event.payload.pttShortcut !== undefined) {
    useSettingsStore.setState({ pttShortcut: event.payload.pttShortcut })
  }
  if (event.payload.soundPack !== undefined) {
    useSettingsStore.setState({ soundPack: event.payload.soundPack })
  }
  if (event.payload.soundVolume !== undefined) {
    useSettingsStore.setState({ soundVolume: event.payload.soundVolume })
  }
  if (event.payload.lightsControlMode !== undefined) {
    useSettingsStore.setState({ lightsControlMode: event.payload.lightsControlMode })
  }
  if (event.payload.confidenceThreshold !== undefined) {
    useSettingsStore.setState({ confidenceThreshold: event.payload.confidenceThreshold })
  }
  if (event.payload.outputDevice !== undefined) {
    useSettingsStore.setState({ outputDevice: event.payload.outputDevice })
  }
  if (event.payload.inputDevice !== undefined) {
    useSettingsStore.setState({ inputDevice: event.payload.inputDevice })
  }

  isUpdatingFromEvent = false
})
