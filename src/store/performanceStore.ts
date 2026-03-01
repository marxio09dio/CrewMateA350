import { listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface TakeoffData {
  vr: number
  flaps: string
  packs?: string
  antiIce?: string
}

interface LandingData {
  flaps: string
  autobrake?: string
}

interface PerformanceStore {
  takeoff: TakeoffData
  landing: LandingData
  setTakeoffData: (data: Partial<TakeoffData>) => void
  setLandingData: (data: Partial<LandingData>) => void
  resetTakeoffData: () => void
  resetLandingData: () => void
}

const defaultTakeoffData: TakeoffData = {
  vr: 100,
  flaps: "1",
  packs: "on",
  antiIce: "off"
}

const defaultLandingData: LandingData = {
  flaps: "Full",
  autobrake: "manual"
}

export const usePerformanceStore = create<PerformanceStore>()(
  persist(
    (set) => ({
      takeoff: defaultTakeoffData,
      landing: defaultLandingData,
      setTakeoffData: (data) =>
        set((state) => ({
          takeoff: { ...state.takeoff, ...data }
        })),
      setLandingData: (data) =>
        set((state) => ({
          landing: { ...state.landing, ...data }
        })),
      resetTakeoffData: () => set({ takeoff: defaultTakeoffData }),
      resetLandingData: () => set({ landing: defaultLandingData })
    }),
    {
      name: "performance-data"
    }
  )
)

listen<Partial<TakeoffData>>("takeoff-updated", (event) => {
  usePerformanceStore.getState().setTakeoffData(event.payload)
})

listen<Partial<LandingData>>("landing-updated", (event) => {
  usePerformanceStore.getState().setLandingData(event.payload)
})
