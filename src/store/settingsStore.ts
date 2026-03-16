import { create } from "zustand"
import { persist } from "zustand/middleware"

export type LightsControlMode = "virtual" | "user"

interface SettingsStore {
  lightsControlMode: LightsControlMode
  setLightsControlMode: (mode: LightsControlMode) => void
}

const defaultLightsControlMode: LightsControlMode = "virtual"

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      lightsControlMode: defaultLightsControlMode,
      setLightsControlMode: (mode) => set({ lightsControlMode: mode })
    }),
    {
      name: "settings"
    }
  )
)
