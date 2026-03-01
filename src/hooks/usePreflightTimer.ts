import { useCallback, useEffect, useRef } from "react"

import { executeFlow } from "@/services/flowRunner"
import { playSound } from "@/services/playSounds"
import { useFlowStore } from "@/store/flowStore"
import { usePreflightTimerStore, type TimelineEvent } from "@/store/preflightTimerStore"

export function usePreflightTimer() {
  const clearLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fireEvent = useCallback((event: TimelineEvent) => {
    const store = usePreflightTimerStore.getState()
    store.setCurrentEvent(`T-${event.minuteMark} ${event.label}`)

    if (clearLabelTimer.current) clearTimeout(clearLabelTimer.current)
    clearLabelTimer.current = setTimeout(() => {
      usePreflightTimerStore.getState().setCurrentEvent(null)
    }, 8000)

    if (event.type === "flow" && event.flowId) {
      executeFlow(event.flowId)
    }

    if (event.sound) {
      playSound(event.sound)
    }
  }, [])

  const processQueue = useCallback(() => {
    const store = usePreflightTimerStore.getState()
    const flowState = useFlowStore.getState().executionState
    if (flowState === "running") return

    const next = store.dequeueEvent()
    if (next) fireEvent(next)
  }, [fireEvent])

  useEffect(() => {
    const id = setInterval(() => {
      const store = usePreflightTimerStore.getState()
      if (!store.isRunning) return

      store.tick()

      const { remainingSeconds, events, firedMarks } = usePreflightTimerStore.getState()
      const currentMinute = Math.ceil(remainingSeconds / 60)

      for (const event of events) {
        if (firedMarks.has(event.minuteMark)) continue
        if (currentMinute <= event.minuteMark) {
          if (remainingSeconds <= event.minuteMark * 60) {
            store.markFired(event.minuteMark)

            const flowState = useFlowStore.getState().executionState
            if (flowState === "running" && event.type === "flow") {
              store.enqueueEvent(event)
            } else {
              fireEvent(event)
            }
          }
        }
      }
    }, 1000)

    return () => clearInterval(id)
  }, [fireEvent])

  useEffect(() => {
    const unsub = useFlowStore.subscribe((state, prev) => {
      if (prev.executionState === "running" && state.executionState !== "running") {
        setTimeout(() => processQueue(), 500)
      }
    })
    return unsub
  }, [processQueue])

  useEffect(() => {
    return () => {
      if (clearLabelTimer.current) clearTimeout(clearLabelTimer.current)
    }
  }, [])
}
