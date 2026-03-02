import { Check, Loader2, Mic, Play, Square, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { allChecklists } from "@/services/checklistLoader"
import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { useChecklistStore } from "@/store/checklistStore"
import type { ChecklistItem } from "@/types/checklist"

function formatResponseToken(token: string): string {
  if (token === "*") return "any"
  if (token === "#2") return "##"
  if (token === "#3") return "###"
  if (token === "#4") return "####"
  return token
}

function getDisplayResponses(item: ChecklistItem): string[] {
  return (item.response ?? []).map(formatResponseToken)
}

export function ChecklistPanel() {
  const { currentChecklist, currentStepIndex, stepStatuses, executionState, error } = useChecklistStore()
  const isRunning = executionState === "running"
  const totalItems = currentChecklist?.items.length ?? 0
  const completedItems = stepStatuses.filter((s) => s === "complete").length

  const [selectedId, setSelectedId] = useState<string>(allChecklists[0]?.id ?? "")

  useEffect(() => {
    if (currentChecklist) setSelectedId(currentChecklist.id)
  }, [currentChecklist])

  const isSilent = allChecklists.find((c) => c.id === selectedId)?.mode === "silent"
  const activeItem: ChecklistItem | null =
    isRunning && currentChecklist ? (currentChecklist.items[currentStepIndex] ?? null) : null
  const activeResponses = activeItem ? getDisplayResponses(activeItem) : []

  return (
    <div className="mt-1 space-y-1">
      {/* Selector row */}
      <div className="flex items-center gap-1.5">
        <span className="text-amber-400 text-[10px] font-mono shrink-0">CL</span>
        <select
          aria-label="Select checklist"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isRunning && currentChecklist?.id !== selectedId}
          className="flex-1 min-w-0 h-6 px-1.5 text-[10px] bg-transparent border border-slate-700/50 text-slate-200 rounded"
        >
          {allChecklists.map((cl) => (
            <option key={cl.id} value={cl.id} className="bg-slate-900 text-slate-200">
              {cl.name}
            </option>
          ))}
        </select>

        <Button
          onClick={() => {
            if (isRunning && currentChecklist?.id === selectedId) {
              abortChecklist()
            } else if (selectedId) {
              executeChecklist(selectedId)
            }
          }}
          disabled={isRunning && currentChecklist?.id !== selectedId}
          className={`h-6 px-2 text-[10px] bg-transparent border border-slate-700/50 hover:bg-amber-400/10 transition shrink-0 ${
            isRunning && currentChecklist?.id === selectedId ? "border-amber-400 bg-amber-400/10" : ""
          } ${isRunning && currentChecklist?.id !== selectedId ? "opacity-40" : ""}`}
        >
          {isRunning && currentChecklist?.id === selectedId ? (
            <Square className="w-2.5 h-2.5 text-red-400" />
          ) : (
            <Play className="w-2.5 h-2.5 text-amber-300" />
          )}
        </Button>
      </div>

      {/* Running state */}
      {currentChecklist && executionState !== "idle" && (
        <div className="space-y-1">
          {/* Thin progress bar */}
          <div className="w-full h-0.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                executionState === "completed"
                  ? "bg-emerald-400"
                  : executionState === "error"
                    ? "bg-red-400"
                    : executionState === "aborted"
                      ? "bg-amber-400"
                      : "bg-amber-400"
              }`}
              style={{
                width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : isSilent && isRunning ? 50 : 0}%`
              }}
            />
          </div>

          {/* Silent mode */}
          {isSilent && isRunning && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" />
              <span>Checking…</span>
            </div>
          )}

          {/* Silent mode results — show failed items */}
          {isSilent && !isRunning && executionState === "error" && (
            <div className="space-y-0.5">
              {currentChecklist.items.map((item, i) =>
                stepStatuses[i] === "failed" ? (
                  <div key={i} className="flex items-center gap-1 text-[10px] text-red-400">
                    <X className="w-2.5 h-2.5 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Normal mode — current item + responses */}
          {!isSilent && isRunning && activeItem && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Mic className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-medium text-amber-300 truncate">{activeItem.label}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {completedItems}/{totalItems}
                </span>
              </div>
              {activeResponses.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {activeResponses.map((r) => (
                    <span
                      key={r}
                      className="px-1.5 py-px rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Normal mode completed/aborted/failed one-liner */}
          {!isRunning && (
            <div className="flex items-center gap-1 text-[10px]">
              {executionState === "completed" && (
                <>
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-emerald-400">Complete</span>
                </>
              )}
              {executionState === "error" && (
                <>
                  <X className="w-2.5 h-2.5 text-red-400" />
                  <span className="text-red-400">{error ?? "Items failed"}</span>
                </>
              )}
              {executionState === "aborted" && (
                <>
                  <X className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-amber-400">Aborted</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
