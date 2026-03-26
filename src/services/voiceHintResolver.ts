import type { Telemetry } from "@/store/telemetryStore"

// Result for VoiceGuide UI — phrases must match CopilotSpeech grammar
export type VoiceHintPhase = {
  id: string
  title: string
  phrases: string[]
}

const N1_IDLE_MAX = 15
const TAXI_MAX_IAS = 45
const LINEUP_MAX_IAS = 60

// Airborne phase thresholds
const INITIAL_CLIMB_RADIO_ALT = 3000
const SHORT_FINAL_RADIO_ALT = 2500

function num(t: Telemetry | null, key: string): number | null {
  if (!t) return null
  const v = t[key]
  return typeof v === "number" ? v : null
}

function isOnGround(t: Telemetry | null): boolean {
  const g = num(t, "onGround")
  return g !== null && g > 0.5
}

function enginesOff(t: Telemetry | null): boolean {
  const m1 = num(t, "mixture1") ?? 1
  const m2 = num(t, "mixture2") ?? 1
  const n1 = num(t, "engineN1_1") ?? 0
  const n2 = num(t, "engineN1_2") ?? 0
  return m1 < 0.5 && m2 < 0.5 && n1 < N1_IDLE_MAX && n2 < N1_IDLE_MAX
}

export type ResolveVoiceHintsArgs = {
  telemetry: Telemetry | null
  lastCompletedChecklistId: string | null
  lastCompletedFlowId: string | null
  voiceChecklistRunning: boolean
  preflightTimerRunning: boolean
}

/**
 * Ground phases progress through the typical SOP flow using lastCompleted* milestones
 * so hints stay relevant without requiring manual phase selection.
 */
export function resolveVoiceHints(args: ResolveVoiceHintsArgs): VoiceHintPhase | null {
  const {
    telemetry: t,
    lastCompletedChecklistId: lastCl,
    lastCompletedFlowId: lastFl,
    voiceChecklistRunning,
    preflightTimerRunning
  } = args

  if (voiceChecklistRunning) return null
  if (!t) return null

  const ias = num(t, "ias") ?? 0
  const vs = num(t, "vs") ?? 0
  const alt = num(t, "alt") ?? 0
  const radioAlt = num(t, "radioAlt") ?? 0
  const flapsIndex = num(t, "flapsIndex") ?? 0
  const ground = isOnGround(t)
  const engOff = enginesOff(t)

  // ── AIRBORNE ────────────────────────────────────────────────────────────────
  if (!ground) {
    const descending = vs < -300

    // Initial climb — below 3 000 ft radio altitude and not descending
    if (radioAlt <= INITIAL_CLIMB_RADIO_ALT && !descending) {
      return {
        id: "initial_climb",
        title: "Initial climb",
        phrases: ["gear up", "flaps X", "autopilot on"]
      }
    }

    // Short final — radioAlt below threshold, descending
    if (radioAlt > 5 && radioAlt <= SHORT_FINAL_RADIO_ALT && descending) {
      return {
        id: "short_final",
        title: "Short final",
        phrases: ["landing checklist", "go around flaps", "continue"]
      }
    }

    // Descent / approach — descending and below 15 000 ft or flaps out
    // NOTE: both conditions require descending to avoid triggering after takeoff with flaps
    if (descending && (alt <= 15000 || flapsIndex > 0)) {
      return {
        id: "descent_approach",
        title: "Descent / approach",
        phrases: ["approach checklist", "gear down", "flaps X"]
      }
    }

    // Climb / cruise — above 3 000 ft, flaps clean, not descending
    return {
      id: "climb_cruise",
      title: "Climb / cruise",
      phrases: ["set standard", "seatbelts off"]
    }
  }

  // ── GROUND ──────────────────────────────────────────────────────────────────
  //
  // Milestone chain (first match wins — ordered by latest SOP milestone)
  //
  const slowGround = ias <= LINEUP_MAX_IAS

  // After landing checklist → touch-and-go / go-around options
  if (lastCl === "landing" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_landing_hints",
      title: "After landing",
      phrases: ["continue", "go around flaps", "go around altitude X"]
    }
  }

  // After takeoff flow → thrust setting + stop
  if (lastFl === "takeoff" && slowGround) {
    return {
      id: "takeoff_thrust",
      title: "Takeoff",
      phrases: ["man flex XX srs runway autothrust blue", "man toga srs autothrust blue", "stop"]
    }
  }

  // After line_up checklist → say "takeoff" to start takeoff flow
  if (lastCl === "line_up" && slowGround) {
    return {
      id: "call_takeoff",
      title: "Takeoff",
      phrases: ["takeoff"]
    }
  }

  // After before_takeoff (line up) flow → call lineup checklist first
  if (lastFl === "before_takeoff" && slowGround) {
    return {
      id: "call_lineup_checklist",
      title: "Line up",
      phrases: ["lineup checklist"]
    }
  }

  // After taxi checklist → line-up / runway entry
  if (lastCl === "taxi" && ias <= LINEUP_MAX_IAS) {
    return {
      id: "after_taxi",
      title: "Line up",
      phrases: ["runway entry procedure", "clear to line up", "lineup checklist"]
    }
  }

  // After flight controls check flow → only taxi checklist remains
  if (lastFl === "after_flight_controls_check" && ias <= TAXI_MAX_IAS) {
    return {
      id: "pre_taxi",
      title: "Taxi",
      phrases: ["taxi checklist"]
    }
  }

  // After clear_left flow → flight controls check + taxi checklist
  if (lastFl === "clear_left" && ias <= TAXI_MAX_IAS) {
    return {
      id: "post_clear_left",
      title: "Taxi",
      phrases: ["flight controls check", "taxi checklist"]
    }
  }

  // After after_start checklist → full taxi prep sequence
  if (lastCl === "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "taxi_phase",
      title: "Taxi",
      phrases: ["clear left", "flight controls check", "taxi checklist"]
    }
  }

  // After after_start flow done, after_start CL not yet run → call for after start
  if (lastFl === "after_start" && lastCl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_start_running",
      title: "After start",
      phrases: ["after start checklist", "flight controls check"]
    }
  }

  // After before_start checklist done → engine start
  if (lastCl === "before_start" && lastFl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "engine_start",
      title: "Engine start",
      phrases: ["starting engine X", "starting number X"]
    }
  }

  // After before_start flow done, checklist not yet called → call for before start
  if (lastFl === "before_start" && lastCl !== "before_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "call_before_start_checklist",
      title: "Ready for before start",
      phrases: ["before start checklist"]
    }
  }

  // After cockpit_preparation checklist → ready to call before start / arm slides
  if (lastCl === "cockpit_preparation") {
    return {
      id: "post_cockpit_prep",
      title: "Before start",
      phrases: ["before start checklist", "cabin crew arm slides"]
    }
  }

  // ── Engines off ─────────────────────────────────────────────────────────────

  // Timeline running → hint cockpit preparation checklist only
  if (preflightTimerRunning && engOff) {
    return {
      id: "prep_timeline",
      title: "Prepare",
      phrases: ["cockpit preparation checklist", "start the apu", "start apu"]
    }
  }

  // Cold & dark, no timeline → initial sequence
  if (engOff) {
    return {
      id: "prep",
      title: "Prepare",
      phrases: ["lets prepare the aircraft", "lets prepare the flight", "lets set up the aircraft"]
    }
  }

  return null
}
