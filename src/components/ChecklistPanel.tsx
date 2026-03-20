import { Loader2, Mic, Play, Square, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { allChecklists } from "@/services/checklistLoader"
import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { useChecklistStore } from "@/store/checklistStore"
import { usePerformanceStore } from "@/store/performanceStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { ChecklistItem } from "@/types/checklist"

const WEIGHT_UNITS = new Set(["tons", "kilograms", "pounds", "kilograms balanced", "pounds balanced"])

function formatResponseToken(token: string): string {
  if (token === "#2") return "##"
  if (token === "#3") return "###"
  if (token === "#4") return "####"
  // Replace any embedded #N placeholders (e.g. "#4 set") with visual hashes
  return token.replace(/#4/g, "####").replace(/#3/g, "###").replace(/#2/g, "##")
}

function getDisplayResponses(item: ChecklistItem): string[] {
  const base = (item.response ?? []).map(formatResponseToken)

  const extras: string[] = []

  // Baro confirmation: show clear examples the pilot can say
  if (item.baro_confirmation) {
    extras.push("qnh #4 set", "altimeter #4 set", "#4 set")
  }

  // Takeoff confirmation: show only the currently-configured thrust variant + safeword
  if (item.takeoff_confirmation) {
    const { v1, vr, v2, thrustSetting } = usePerformanceStore.getState().takeoff
    const flexTemp = useTelemetryStore.getState().telemetry?.iniFlexTemperature
    const thrust = thrustSetting === "flex" ? `flex ${flexTemp !== undefined ? Math.round(flexTemp) : "??"}` : "toga"
    extras.push(`v1 ${v1} vr ${vr} v2 ${v2} ${thrust}`, "set and checked")
    return extras
  }

  // If an item expects feet (minimums), show BARO/RADIO examples
  if ((item.response ?? []).some((r) => r.toLowerCase().includes("feet"))) {
    extras.push("baro #3 feet", "radio #3 feet")
  }

  // Merge, preserve order, remove duplicates
  const combined = [...extras, ...base]
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of combined) {
    const v = formatResponseToken(t)
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  // If explicit BARO/RADIO examples were added, hide the generic "feet"
  const hasBaroRadio = out.some((s) => s.toLowerCase().includes("baro") || s.toLowerCase().includes("radio"))
  let filtered = out
  if (hasBaroRadio) {
    filtered = filtered.filter((s) => s.toLowerCase() !== "feet")
  }

  // If the item is a baro confirmation (or we added baro-style set examples),
  // hide the plain "set" token so pilots see only numeric-set variants like
  // "#### set" / "qnh #### set" / "altimeter #### set". Keep "set and checked".
  const hasBaroSetExample =
    filtered.some(
      (s) =>
        s.toLowerCase().includes("#### set") || s.toLowerCase().includes("qnh") || s.toLowerCase().includes("altimeter")
    ) || item.baro_confirmation === true

  if (hasBaroSetExample) {
    filtered = filtered.filter((s) => s.toLowerCase() !== "set")
  }

  return filtered
}

export function ChecklistPanel() {
  const { currentChecklist, currentStepIndex, stepStatuses, executionState } = useChecklistStore()
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

  function renderResponseToken(r: string) {
    if (WEIGHT_UNITS.has(r)) return `xxx.x ${r}`
    if (r === "feet") return "xxxx feet"
    return r
  }

  return (
    <div className="mt-1 space-y-1">
      {/* Selector row */}
      <div className="flex items-center gap-1.5">
        <span className="text-amber-400 text-xs font-mono shrink-0">CL</span>
        <select
          aria-label="Select checklist"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isRunning && currentChecklist?.id !== selectedId}
          className="flex-1 min-w-0 h-6 px-1.5 text-xs bg-transparent border border-slate-700/50 text-slate-200 rounded"
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
          className={`h-6 px-2 text-xs bg-transparent border border-slate-700/50 hover:bg-amber-400/10 transition shrink-0 ${
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
          {/* Silent mode */}
          {isSilent && isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" />
              <span>Checking…</span>
            </div>
          )}

          {/* Silent mode results — show failed items */}
          {isSilent && !isRunning && executionState === "error" && (
            <div className="space-y-0.5">
              {currentChecklist.items.map((item, i) =>
                stepStatuses[i] === "failed" ? (
                  <div key={i} className="flex items-center gap-1 text-xs text-red-400">
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
                  <span className="text-xs font-medium text-amber-300 truncate">{activeItem.label}</span>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {completedItems}/{totalItems}
                </span>
              </div>
              {activeResponses.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">You can say:</div>
                  <div className="flex flex-wrap gap-1">
                    {activeResponses.map((r) => (
                      <span
                        key={r}
                        className="px-1.5 py-px rounded text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700"
                      >
                        {renderResponseToken(r)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
