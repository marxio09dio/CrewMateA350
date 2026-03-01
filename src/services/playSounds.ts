import { invoke } from "@tauri-apps/api/core"

import { useVoiceStore } from "@/store/voiceStore"

interface PlaySoundOptions {
  pack?: string
  volume?: number
}

export const playSound = async (filename: string, options?: PlaySoundOptions) => {
  try {
    const state = useVoiceStore.getState()
    const soundPack = options?.pack ?? state.soundPack
    const volume = options?.volume ?? state.soundVolume / 100
    await invoke("play_sound", {
      filename,
      pack: soundPack,
      volume
    })
  } catch (error) {
    console.error("Error playing sound via backend:", error)
  }
}

export const isSoundPlaying = async (): Promise<boolean> => {
  try {
    return await invoke<boolean>("is_audio_playing")
  } catch {
    return false
  }
}
