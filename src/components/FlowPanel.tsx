import { Play, Square, Check, X, SkipForward, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { allFlows } from "@/services/flowLoader"
import { executeFlow, abortFlow } from "@/services/flowRunner"
import { useFlowStore } from "@/store/flowStore"
import type { StepStatus } from "@/types/flow"

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "done":
      return <Check className="w-3 h-3 text-emerald-400" />
    case "skipped":
      return <SkipForward className="w-3 h-3 text-slate-400" />
    case "failed":
      return <X className="w-3 h-3 text-red-400" />
    case "executing":
    case "verifying":
      return <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
    default:
      return <div className="w-3 h-3 rounded-full border border-slate-600" />
  }
}

export function FlowPanel() {
  const { currentFlow, currentStepIndex, stepStatuses, executionState, error } = useFlowStore()
  const isRunning = executionState === "running"
  const totalSteps = currentFlow?.steps.length ?? 0
  const completedSteps = stepStatuses.filter((s) => s === "done" || s === "skipped").length

  return (
    <div className="mt-4 space-y-3">
      {/* Flow list */}
      <div className="flex flex-wrap gap-2">
        <TooltipProvider>
          {allFlows.map((flow) => {
            const isActive = currentFlow?.id === flow.id && isRunning
            return (
              <Tooltip key={flow.id}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => (isActive ? abortFlow() : executeFlow(flow.id))}
                    disabled={isRunning && !isActive}
                    className={`
                      h-8 px-3 text-xs bg-transparent border border-slate-700/50
                      hover:bg-cyan-400/10 transition
                      ${isActive ? "border-cyan-400 bg-cyan-400/10" : ""}
                      ${isRunning && !isActive ? "opacity-40" : ""}
                    `}
                  >
                    {isActive ? (
                      <Square className="w-3 h-3 mr-1.5 text-red-400" />
                    ) : (
                      <Play className="w-3 h-3 mr-1.5 text-cyan-300" />
                    )}
                    <span className="text-slate-200">{flow.name}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isActive ? "Stop flow" : `Run ${flow.name} (${flow.steps.length} steps)`}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </TooltipProvider>
      </div>

      {/* Active flow progress */}
      {currentFlow && executionState !== "idle" && (
        <div className="border border-slate-700/50 rounded-lg p-3 bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-200">{currentFlow.name}</span>
            <span className="text-xs text-slate-400">
              {completedSteps}/{totalSteps} steps
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full mb-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                executionState === "completed"
                  ? "bg-emerald-400"
                  : executionState === "error"
                    ? "bg-red-400"
                    : executionState === "aborted"
                      ? "bg-amber-400"
                      : "bg-cyan-400"
              }`}
              style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
            />
          </div>

          {/* Step list */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {currentFlow.steps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs py-0.5 px-1 rounded ${
                  i === currentStepIndex && isRunning ? "bg-slate-800/80" : ""
                }`}
              >
                <StepStatusIcon status={stepStatuses[i] ?? "pending"} />
                <span
                  className={
                    stepStatuses[i] === "done" || stepStatuses[i] === "skipped"
                      ? "text-slate-500"
                      : i === currentStepIndex && isRunning
                        ? "text-cyan-300"
                        : "text-slate-400"
                  }
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Status footer */}
          {executionState === "completed" && <p className="text-xs text-emerald-400 mt-2">Flow completed</p>}
          {executionState === "error" && <p className="text-xs text-red-400 mt-2">Error: {error}</p>}
          {executionState === "aborted" && <p className="text-xs text-amber-400 mt-2">Flow aborted</p>}
        </div>
      )}
    </div>
  )
}
