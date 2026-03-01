import { useEffect, useRef, useCallback } from "react"

import { playSound, isSoundPlaying } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

type LandingPhase = "idle" | "spoilers" | "reverser" | "decel"

interface SpeedCalloutFlags {
  called100: boolean
  called70: boolean
  calledVr: boolean
  vrInhibit: boolean
}

interface AltitudeCalloutFlags {
  positiveClimb: boolean
  tenThousandClimb: boolean
  tenThousandDescent: boolean
  transitionAltitude: boolean
  transitionLevel: boolean
}

interface LandingSequenceState {
  wasAirborne: boolean
  phase: LandingPhase
  phaseStartTime: number | null
  done: boolean
}

interface PreviousValues {
  speed: number
  alt: number
  onGround: number
}

const crossedUp = (prev: number, curr: number, threshold: number) => prev < threshold && curr >= threshold

const crossedDown = (prev: number, curr: number, threshold: number) => prev > threshold && curr <= threshold

const advancePhase = (ls: LandingSequenceState, next: LandingPhase, now: number) => {
  ls.phase = next
  ls.phaseStartTime = now
}

const completeLanding = (ls: LandingSequenceState) => {
  ls.phase = "idle"
  ls.phaseStartTime = null
  ls.done = true
}

const resetLanding = (ls: LandingSequenceState) => {
  ls.phase = "idle"
  ls.phaseStartTime = null
  ls.done = false
}

// ─── Landing phase handlers ──────────────────────────────────────────────────

const SPOILER_TIMEOUT = 3000
const REVERSER_TIMEOUT = 3000
const DECEL_TIMEOUT = 10000

function handleSpoilersPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) {
  if (t.spoilersHandlePosition > 0.1) {
    playSound("spoilers.ogg")
    advancePhase(ls, "reverser", now)
  } else if (elapsed >= SPOILER_TIMEOUT) {
    playSound("no_spoilers.ogg")
    advancePhase(ls, "reverser", now)
  }
}

function handleReverserPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) {
  if (t.throttleLever1 < -0.1 || t.throttleLever2 < -0.1) {
    playSound("reverse_green.ogg")
    advancePhase(ls, "decel", now)
  } else if (elapsed >= REVERSER_TIMEOUT) {
    playSound("no_reverse_engine_1_and_2.ogg")
    advancePhase(ls, "decel", now)
  }
}

function handleDecelPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number) {
  const brakesApplied = t.brakeLeftPosition > 0.1 || t.brakeRightPosition > 0.1
  if (brakesApplied && t.ias > 40) {
    playSound("decel.ogg")
    completeLanding(ls)
  } else if (elapsed >= DECEL_TIMEOUT) {
    completeLanding(ls)
  }
}

const phaseHandlers: Record<
  Exclude<LandingPhase, "idle">,
  (ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) => void
> = {
  spoilers: handleSpoilersPhase,
  reverser: handleReverserPhase,
  decel: handleDecelPhase
}

export function useCallouts(vrSpeed: number) {
  const speed = useRef<SpeedCalloutFlags>({
    called100: false,
    called70: false,
    calledVr: false,
    vrInhibit: true
  })

  const altitude = useRef<AltitudeCalloutFlags>({
    positiveClimb: false,
    tenThousandClimb: false,
    tenThousandDescent: false,
    transitionAltitude: false,
    transitionLevel: false
  })

  const landing = useRef<LandingSequenceState>({
    wasAirborne: false,
    phase: "idle",
    phaseStartTime: null,
    done: false
  })

  const prev = useRef<PreviousValues>({
    speed: 0,
    alt: 0,
    onGround: 1
  })

  const vrSpeedRef = useRef(vrSpeed)
  vrSpeedRef.current = vrSpeed

  const tick = useCallback(async () => {
    const t = useTelemetryStore.getState().telemetry
    if (!t || t.isSlewActive) return

    const sp = speed.current
    const al = altitude.current
    const ls = landing.current
    const p = prev.current
    const vr = vrSpeedRef.current
    const now = Date.now()

    // Takeoff / landing edge detection
    if (!t.onGround && p.onGround) {
      sp.called100 = false
      sp.vrInhibit = true
      al.positiveClimb = false
      al.tenThousandClimb = false
      al.transitionAltitude = false
    }

    if (t.onGround && !p.onGround) {
      sp.called70 = false
      sp.vrInhibit = true
      al.tenThousandDescent = false
      al.transitionLevel = false
    }

    // Speed callouts (ground)
    if (t.onGround && !sp.vrInhibit && vr && !isNaN(vr) && t.ias >= vr && t.ias < vr + 5 && !sp.calledVr) {
      playSound("rotate.ogg")
      sp.calledVr = true
      sp.vrInhibit = true
    }

    if (t.onGround && crossedUp(p.speed, t.ias, 100) && !sp.called100) {
      playSound("100_knots.ogg")
      sp.called100 = true
    }

    if (t.onGround && crossedDown(p.speed, t.ias, 70) && !sp.called70) {
      playSound("70_knots.ogg")
      sp.called70 = true
    }

    // Positive climb
    if (!t.onGround && t.vs > 120 && t.radioAlt > 30 && !al.positiveClimb) {
      playSound("positive_climb.ogg")
      al.positiveClimb = true
    }

    // Ten thousand feet
    if (!t.onGround && t.vs > 100 && !al.tenThousandClimb && crossedUp(p.alt, t.alt, 10000)) {
      playSound(t.transitionAltitude < 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandClimb = true
    }

    if (!t.onGround && t.vs < -100 && !al.tenThousandDescent && crossedDown(p.alt, t.alt, 10000)) {
      playSound(t.transitionLevel > 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandDescent = true
    }

    // Transition altitude / level
    if (
      !t.onGround &&
      t.vs > 100 &&
      !al.transitionAltitude &&
      t.transitionAltitude > 0 &&
      crossedUp(p.alt, t.alt, t.transitionAltitude)
    ) {
      playSound("transiton_altitude.ogg")
      al.transitionAltitude = true
    }

    if (
      !t.onGround &&
      t.vs < -100 &&
      !al.transitionLevel &&
      t.transitionLevel > 0 &&
      crossedDown(p.alt, t.alt, t.transitionLevel)
    ) {
      playSound("transiton_level.ogg")
      al.transitionLevel = true
    }

    // Re-arm at taxi speed
    if (t.onGround && t.ias < 30) {
      sp.calledVr = false
      sp.called100 = false
      sp.vrInhibit = false
    }

    // Landing sequence

    // Track sustained airborne (vs > 200 filters ground bounces)
    if (!t.onGround && t.vs > 200) {
      ls.wasAirborne = true
    }

    // Arm: landing (was airborne → now on ground)
    if (t.onGround && ls.wasAirborne && ls.phase === "idle" && !ls.done) {
      advancePhase(ls, "spoilers", now)
      ls.wasAirborne = false
    }

    // Arm: RTO (never airborne, spoilers deployed at speed)
    if (
      t.onGround &&
      !ls.wasAirborne &&
      ls.phase === "idle" &&
      !ls.done &&
      t.spoilersHandlePosition > 0.1 &&
      t.ias > 60
    ) {
      advancePhase(ls, "spoilers", now)
    }

    // Reset on sustained climb-away
    if (!t.onGround && t.vs > 500) {
      resetLanding(ls)
      ls.wasAirborne = false
    }

    // Reset on taxi
    if (t.onGround && t.ias < 30) {
      resetLanding(ls)
    }

    // Process landing phases (skip if idle or audio still playing)
    if (ls.phase !== "idle" && !(await isSoundPlaying())) {
      const elapsed = ls.phaseStartTime ? now - ls.phaseStartTime : 0
      phaseHandlers[ls.phase](ls, t, elapsed, now)
    }

    // Update previous values
    p.speed = t.ias
    p.alt = t.alt
    p.onGround = t.onGround
  }, [])

  useEffect(() => {
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [tick])
}
