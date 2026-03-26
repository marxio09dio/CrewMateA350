import { useEffect, useMemo, useRef } from "react"

import { getDisplayResponses } from "@/services/checklistResponseHelper"
import { resolveVoiceHints } from "@/services/voiceHintResolver"
import type { VoiceHintPhase } from "@/services/voiceHintResolver"
import { useChecklistStore } from "@/store/checklistStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import { useVoiceHintProgressStore } from "@/store/voiceHintProgressStore"

type UseVoiceHintsOptions = {
  voiceEnabled: boolean
  connected: boolean
}

// Context aware voice hints from telemetry and session milestones
export function useVoiceHints({ voiceEnabled, connected }: UseVoiceHintsOptions): VoiceHintPhase | null {
  const telemetry = useTelemetryStore((s) => s.telemetry)
  const lastCl = useVoiceHintProgressStore((s) => s.lastCompletedChecklistId)
  const lastFl = useVoiceHintProgressStore((s) => s.lastCompletedFlowId)
  const onAirborneTransition = useVoiceHintProgressStore((s) => s.onAirborneTransition)
  const preflightTimerRunning = usePreflightTimerStore((s) => s.isRunning)

  const currentChecklist = useChecklistStore((s) => s.currentChecklist)
  const currentStepIndex = useChecklistStore((s) => s.currentStepIndex)
  const executionState = useChecklistStore((s) => s.executionState)

  const prevGroundedRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (!connected || !telemetry) return
    const grounded = telemetry.onGround > 0.5
    if (prevGroundedRef.current === true && !grounded) {
      onAirborneTransition()
    }
    prevGroundedRef.current = grounded
  }, [connected, telemetry, onAirborneTransition])

  return useMemo(() => {
    if (!voiceEnabled || !connected) return null

    const voiceChecklistRunning =
      executionState === "running" && currentChecklist !== null && currentChecklist.mode !== "silent"

    // While a challenge/response checklist is active, show expected response phrases
    if (voiceChecklistRunning && currentChecklist) {
      const activeItem = currentChecklist.items[currentStepIndex] ?? null
      if (activeItem) {
        const phrases = getDisplayResponses(activeItem)
        if (phrases.length > 0) {
          return {
            id: "checklist_response",
            title: activeItem.label,
            phrases
          }
        }
      }
    }

    return resolveVoiceHints({
      telemetry,
      lastCompletedChecklistId: lastCl,
      lastCompletedFlowId: lastFl,
      voiceChecklistRunning,
      preflightTimerRunning
    })
  }, [
    voiceEnabled,
    connected,
    telemetry,
    lastCl,
    lastFl,
    executionState,
    currentChecklist,
    currentStepIndex,
    preflightTimerRunning
  ])
}
