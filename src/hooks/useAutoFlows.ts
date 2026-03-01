import { useEffect, useRef, useCallback } from "react"

import { executeFlow } from "@/services/flowRunner"
import { useFlowStore } from "@/store/flowStore"
import { useTelemetryStore } from "@/store/telemetryStore"

/**
 * Tracks which auto-triggered flows have already fired this phase.
 * Reset selectively on ground↔airborne transitions.
 */
interface TriggeredFlags {
  afterStart: boolean
  afterTakeoff: boolean
  afterLanding: boolean
  climbTenK: boolean
  descTenK: boolean
  shutdown: boolean
}

interface PrevValues {
  onGround: number
  ignitionKnob: number
  flapsIndex: number
  spoilersArmed: number
  alt: number
  mixture1: number
  mixture2: number
}

export function useAutoFlows() {
  const triggered = useRef<TriggeredFlags>({
    afterStart: false,
    afterTakeoff: false,
    afterLanding: false,
    climbTenK: false,
    descTenK: false,
    shutdown: false
  })

  const prev = useRef<PrevValues>({
    onGround: 1,
    ignitionKnob: 0,
    flapsIndex: 0,
    spoilersArmed: 0,
    alt: 0,
    mixture1: 1,
    mixture2: 1
  })

  const phase = useRef<"ground" | "airborne">("ground")
  const primed = useRef(false)

  const tick = useCallback(() => {
    const t = useTelemetryStore.getState().telemetry
    if (!t || t.isSlewActive) return

    // First tick: seed previous values from live telemetry so we don't
    // detect false edges (e.g. ignitionKnob already 1 on app start).
    if (!primed.current) {
      primed.current = true
      prev.current.onGround = t.onGround
      prev.current.ignitionKnob = t.ignitionKnob ?? 0
      prev.current.flapsIndex = t.flapsIndex ?? 0
      prev.current.spoilersArmed = t.spoilersArmed ?? 0
      prev.current.alt = t.alt ?? 0
      prev.current.mixture1 = t.mixture1 ?? 1
      prev.current.mixture2 = t.mixture2 ?? 1
      phase.current = t.onGround ? "ground" : "airborne"
      return
    }

    const fl = triggered.current
    const p = prev.current
    const isRunning = useFlowStore.getState().executionState === "running"

    if (phase.current === "ground" && !t.onGround && t.vs > 200) {
      // Ground → Airborne
      phase.current = "airborne"
      fl.afterStart = false
      fl.shutdown = false
      fl.afterLanding = false
    }

    if (phase.current === "airborne" && t.onGround && t.ias < 80) {
      // Airborne → Ground
      phase.current = "ground"
      fl.afterTakeoff = false
      fl.climbTenK = false
      fl.descTenK = false
    }

    if (!isRunning) {
      // After Start: ignition knob 0 → 1 while on ground
      if (!fl.afterStart && t.onGround && p.ignitionKnob === 2 && t.ignitionKnob === 1) {
        fl.afterStart = true
        executeFlow("after_start")
      }

      // After Takeoff: flaps retracted to 0 while airborne
      else if (!fl.afterTakeoff && !t.onGround && p.flapsIndex > 0 && t.flapsIndex === 0) {
        fl.afterTakeoff = true
        executeFlow("after_takeoff")
      }

      // After Landing: spoilers disarmed on ground
      else if (!fl.afterLanding && t.onGround && p.spoilersArmed === 1 && t.spoilersArmed === 0) {
        fl.afterLanding = true
        executeFlow("after_landing")
      }

      // Climb through 10,000 ft
      else if (!fl.climbTenK && !t.onGround && t.vs > 100 && p.alt < 10000 && t.alt >= 10000) {
        fl.climbTenK = true
        executeFlow("climb_ten_thousand_flow")
      }

      // Descend through 10,000 ft
      else if (!fl.descTenK && !t.onGround && t.vs < -100 && p.alt > 10000 && t.alt <= 10000) {
        fl.descTenK = true
        executeFlow("desc_ten_thousand_flow")
      }

      // Shutdown: both engine master switches to cutoff on ground
      else if (
        !fl.shutdown &&
        t.onGround &&
        (p.mixture1 === 1 || p.mixture2 === 1) &&
        t.mixture1 === 0 &&
        t.mixture2 === 0
      ) {
        fl.shutdown = true
        executeFlow("shutdown")
      }
    }

    p.onGround = t.onGround
    p.ignitionKnob = t.ignitionKnob ?? 0
    p.flapsIndex = t.flapsIndex ?? 0
    p.spoilersArmed = t.spoilersArmed ?? 0
    p.alt = t.alt ?? 0
    p.mixture1 = t.mixture1 ?? 1
    p.mixture2 = t.mixture2 ?? 1
  }, [])

  useEffect(() => {
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [tick])
}
