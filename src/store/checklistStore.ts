import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Checklist, ChecklistExecutionState, ChecklistStepStatus } from "@/types/checklist"

interface ChecklistStore {
  currentChecklist: Checklist | null
  currentStepIndex: number
  stepStatuses: ChecklistStepStatus[]
  executionState: ChecklistExecutionState
  error: string | null
  holdOnIncorrect: boolean

  setChecklist: (checklist: Checklist) => void
  setStepIndex: (index: number) => void
  setStepStatus: (index: number, status: ChecklistStepStatus) => void
  setExecutionState: (state: ChecklistExecutionState) => void
  setError: (error: string | null) => void
  setHoldOnIncorrect: (hold: boolean) => void
  reset: () => void
}

export const useChecklistStore = create<ChecklistStore>()(
  persist(
    (set) => ({
      currentChecklist: null,
      currentStepIndex: 0,
      stepStatuses: [],
      executionState: "idle",
      error: null,
      holdOnIncorrect: false,

      setChecklist: (checklist) =>
        set({
          currentChecklist: checklist,
          currentStepIndex: 0,
          stepStatuses: checklist.items.map(() => "pending"),
          executionState: "running",
          error: null
        }),

      setStepIndex: (index) => set({ currentStepIndex: index }),

      setStepStatus: (index, status) =>
        set((state) => {
          const statuses = [...state.stepStatuses]
          statuses[index] = status
          return { stepStatuses: statuses }
        }),

      setExecutionState: (executionState) => set({ executionState }),

      setError: (error) => set({ error, executionState: "error" }),

      setHoldOnIncorrect: (hold) => set({ holdOnIncorrect: hold }),

      reset: () =>
        set({
          currentChecklist: null,
          currentStepIndex: 0,
          stepStatuses: [],
          executionState: "idle",
          error: null
        })
    }),
    {
      name: "checklist-settings",
      partialize: (state) => ({ holdOnIncorrect: state.holdOnIncorrect })
    }
  )
)
