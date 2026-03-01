import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface VoiceStore {
  voiceEnabled: boolean
  voiceMode: "continuous" | "ptt"
  pttShortcut: string
  soundPack: string
  soundVolume: number
  micGain: number
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceMode: (mode: "continuous" | "ptt") => void
  setPttShortcut: (shortcut: string) => void
  setSoundPack: (pack: string) => void
  setSoundVolume: (volume: number) => void
  setMicGain: (gain: number) => void
}

let isUpdatingFromEvent = false

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set) => ({
      voiceEnabled: false,
      voiceMode: "continuous",
      pttShortcut: "CmdOrCtrl+Shift+Space",
      soundPack: "Jenny",
      soundVolume: 100,
      micGain: 180,
      setVoiceEnabled: (enabled) => {
        set({ voiceEnabled: enabled })
        if (!isUpdatingFromEvent) {
          emit("voice-settings-changed", { voiceEnabled: enabled })
        }
      },
      setVoiceMode: (mode) => {
        set({ voiceMode: mode })
        if (!isUpdatingFromEvent) {
          emit("voice-settings-changed", { voiceMode: mode })
        }
      },
      setPttShortcut: (shortcut) => {
        set({ pttShortcut: shortcut })
        if (!isUpdatingFromEvent) {
          emit("voice-settings-changed", { pttShortcut: shortcut })
        }
      },
      setSoundPack: (pack) => {
        set({ soundPack: pack })
        if (!isUpdatingFromEvent) {
          emit("voice-settings-changed", { soundPack: pack })
        }
      },
      setSoundVolume: (volume) => {
        set({ soundVolume: volume })
        if (!isUpdatingFromEvent) {
          emit("voice-settings-changed", { soundVolume: volume })
        }
      },
      setMicGain: (gain) => {
        set({ micGain: gain })
        invoke("set_mic_gain", { gain: gain / 100 }).catch(() => {})
        if (!isUpdatingFromEvent) {
          emit("voice-settings-changed", { micGain: gain })
        }
      }
    }),
    {
      name: "voice-settings",
      onRehydrateStorage: () => (state) => {
        if (state?.micGain) {
          invoke("set_mic_gain", { gain: state.micGain / 100 }).catch(() => {})
        }
      }
    }
  )
)

listen<Partial<Omit<VoiceStore, "setVoiceEnabled" | "setVoiceMode" | "setPttShortcut" | "setSoundPack">>>(
  "voice-settings-changed",
  (event) => {
    isUpdatingFromEvent = true

    if (event.payload.voiceEnabled !== undefined) {
      useVoiceStore.setState({ voiceEnabled: event.payload.voiceEnabled })
    }
    if (event.payload.voiceMode !== undefined) {
      useVoiceStore.setState({ voiceMode: event.payload.voiceMode })
    }
    if (event.payload.pttShortcut !== undefined) {
      useVoiceStore.setState({ pttShortcut: event.payload.pttShortcut })
    }
    if (event.payload.soundPack !== undefined) {
      useVoiceStore.setState({ soundPack: event.payload.soundPack })
    }
    if (event.payload.soundVolume !== undefined) {
      useVoiceStore.setState({ soundVolume: event.payload.soundVolume })
    }
    if (event.payload.micGain !== undefined) {
      useVoiceStore.setState({ micGain: event.payload.micGain })
    }

    isUpdatingFromEvent = false
  }
)
