import { create } from "zustand"

const ACTIVE_TIMEOUT_MS = 25_000

interface GroundEngineerStore {
  isActive: boolean
  activate: () => void
  deactivate: () => void
}

let timeoutId: ReturnType<typeof setTimeout> | null = null

export const useGroundEngineerStore = create<GroundEngineerStore>()((set) => ({
  isActive: false,
  activate: () => {
    if (timeoutId) clearTimeout(timeoutId)
    set({ isActive: true })
    timeoutId = setTimeout(() => {
      set({ isActive: false })
      timeoutId = null
    }, ACTIVE_TIMEOUT_MS)
  },
  deactivate: () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    set({ isActive: false })
  }
}))
