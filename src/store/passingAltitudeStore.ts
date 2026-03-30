import { create } from "zustand"

interface PassingAltitudeStore {
  // Target altitude to announce "now" when reached
  targetAltitude: number | null
  hasCalled: boolean

  setTarget: (altitude: number) => void
  markCalled: () => void
  reset: () => void
  isTracking: () => boolean
}

export const usePassingAltitudeStore = create<PassingAltitudeStore>()((set, get) => ({
  targetAltitude: null,
  hasCalled: false,

  setTarget: (altitude) => set({ targetAltitude: altitude, hasCalled: false }),
  markCalled: () => set({ hasCalled: true }),
  reset: () => set({ targetAltitude: null, hasCalled: false }),
  isTracking: () => get().targetAltitude !== null
}))
