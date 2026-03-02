import { create } from "zustand"

import type { Checklist, ChecklistExecutionState, ChecklistStepStatus } from "@/types/checklist"

interface ChecklistStore {
  currentChecklist: Checklist | null
  currentStepIndex: number
  stepStatuses: ChecklistStepStatus[]
  executionState: ChecklistExecutionState
  error: string | null

  setChecklist: (checklist: Checklist) => void
  setStepIndex: (index: number) => void
  setStepStatus: (index: number, status: ChecklistStepStatus) => void
  setExecutionState: (state: ChecklistExecutionState) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useChecklistStore = create<ChecklistStore>()((set) => ({
  currentChecklist: null,
  currentStepIndex: 0,
  stepStatuses: [],
  executionState: "idle",
  error: null,

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

  reset: () =>
    set({
      currentChecklist: null,
      currentStepIndex: 0,
      stepStatuses: [],
      executionState: "idle",
      error: null
    })
}))
