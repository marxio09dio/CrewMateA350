import { create } from "zustand"

interface GoAroundStore {
  /** Incremented each time a go-around is triggered. Hooks compare against last seen value. */
  count: number
  trigger: () => void
}

export const useGoAroundStore = create<GoAroundStore>()((set) => ({
  count: 0,
  trigger: () => set((s) => ({ count: s.count + 1 }))
}))
