import { create } from "zustand"

import type { Flow, FlowExecutionState, StepStatus } from "@/types/flow"

interface FlowStore {
  currentFlow: Flow | null
  currentStepIndex: number
  stepStatuses: StepStatus[]
  executionState: FlowExecutionState
  error: string | null

  setFlow: (flow: Flow) => void
  setStepIndex: (index: number) => void
  setStepStatus: (index: number, status: StepStatus) => void
  setExecutionState: (state: FlowExecutionState) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useFlowStore = create<FlowStore>()((set) => ({
  currentFlow: null,
  currentStepIndex: 0,
  stepStatuses: [],
  executionState: "idle",
  error: null,

  setFlow: (flow) =>
    set({
      currentFlow: flow,
      currentStepIndex: 0,
      stepStatuses: flow.steps.map(() => "pending"),
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
      currentFlow: null,
      currentStepIndex: 0,
      stepStatuses: [],
      executionState: "idle",
      error: null
    })
}))
