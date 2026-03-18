import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type LightsControlMode = "virtual" | "user"

const defaultLightsControlMode: LightsControlMode = "virtual"

interface SettingsStore {
  voiceEnabled: boolean
  voiceMode: "continuous" | "ptt"
  pttShortcut: string
  soundPack: string
  soundVolume: number
  lightsControlMode: LightsControlMode
  confidenceThreshold: number
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceMode: (mode: "continuous" | "ptt") => void
  setPttShortcut: (shortcut: string) => void
  setSoundPack: (pack: string) => void
  setSoundVolume: (volume: number) => void
  setLightsControlMode: (mode: LightsControlMode) => void
  setConfidenceThreshold: (threshold: number) => void
}

let isUpdatingFromEvent = false

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      voiceEnabled: false,
      voiceMode: "continuous",
      pttShortcut: "CmdOrCtrl+Shift+Space",
      soundPack: "Jenny",
      soundVolume: 100,
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
      setLightsControlMode: (mode) => {
        set({ lightsControlMode: mode })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { lightsControlMode: mode })
        }
      },
      setConfidenceThreshold: (threshold) => {
        set({ confidenceThreshold: threshold })
        invoke("set_confidence_threshold", { threshold: threshold / 100 })
        if (!isUpdatingFromEvent) {
          emit("settings-changed", { confidenceThreshold: threshold })
        }
      }
    }),
    {
      name: "voice-settings",
      onRehydrateStorage: () => (state) => {
        if (state) invoke("set_confidence_threshold", { threshold: state.confidenceThreshold / 100 })
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

  isUpdatingFromEvent = false
})
