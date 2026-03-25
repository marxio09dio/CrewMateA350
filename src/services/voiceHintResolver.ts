import type { Telemetry } from "@/store/telemetryStore"

// Result for VoiceGuide UI — phrases must match CopilotSpeech grammar /
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

function enginesRunning(t: Telemetry | null): boolean {
  const m1 = num(t, "mixture1") ?? 0
  const m2 = num(t, "mixture2") ?? 0
  const n1 = num(t, "engineN1_1") ?? 0
  const n2 = num(t, "engineN1_2") ?? 0
  return (m1 > 0.5 && m2 > 0.5) || (n1 >= N1_IDLE_MAX && n2 >= N1_IDLE_MAX)
}

export type ResolveVoiceHintsArgs = {
  telemetry: Telemetry | null
  lastCompletedChecklistId: string | null
  lastCompletedFlowId: string | null
  voiceChecklistRunning: boolean
}

/**
 * Ground phases progress through the typical SOP flow using lastCompleted* milestones
 * so hints stay relevant without requiring manual phase selection.
 */
export function resolveVoiceHints(args: ResolveVoiceHintsArgs): VoiceHintPhase | null {
  const { telemetry: t, lastCompletedChecklistId: lastCl, lastCompletedFlowId: lastFl, voiceChecklistRunning } = args

  if (voiceChecklistRunning) return null
  if (!t) return null

  const ias = num(t, "ias") ?? 0
  const vs = num(t, "vs") ?? 0
  const alt = num(t, "alt") ?? 0
  const radioAlt = num(t, "radioAlt") ?? 0
  const flapsIndex = num(t, "flapsIndex") ?? 0
  const ground = isOnGround(t)
  const engOff = enginesOff(t)
  const engOn = enginesRunning(t)

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

    // Descent / approach — below 10 500 ft descending, or flaps out
    if ((descending && alt <= 10500) || flapsIndex > 0) {
      return {
        id: "descent_approach",
        title: "Descent / approach",
        phrases: ["approach checklist", "gear down", "flaps X"]
      }
    }

    // Climb / cruise — above 3 000 ft, flaps clean
    return {
      id: "climb_cruise",
      title: "Climb / cruise",
      phrases: ["set standard", "seatbelts off"]
    }
  }

  // ── GROUND ──────────────────────────────────────────────────────────────────
  //
  // Milestone chain (first match wins):
  //   before_start flow → before_start CL → after_start flow → after_start CL
  //     → taxi CL → line_up CL / before_takeoff flow → takeoff
  //
  const slowGround = ias <= LINEUP_MAX_IAS

  // After line-up checklist or before_takeoff flow → ready for takeoff
  if ((lastCl === "line_up" || lastFl === "before_takeoff") && slowGround) {
    return {
      id: "takeoff_prep",
      title: "Takeoff",
      phrases: ["takeoff", "man flex XX srs runway autothrust blue", "man toga srs autothrust blue", "stop"]
    }
  }

  // After taxi checklist → line-up / runway
  if (lastCl === "taxi" && ias <= LINEUP_MAX_IAS) {
    return {
      id: "after_taxi",
      title: "Line up",
      phrases: ["runway entry procedure", "clear to line up", "lineup checklist"]
    }
  }

  // After after_start checklist → taxi / controls check phase
  if (lastCl === "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "taxi_phase",
      title: "Taxi",
      phrases: ["flight controls check", "taxi lights on", "taxi checklist"]
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

  // After before_start checklist done, engines not yet started → engine start
  //    (covers intermediate state where one engine is running but not both)
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

  // ── Engines off ────────────────────────────────────────────

  if (engOff) {
    return {
      id: "prep",
      title: "Prepare",
      phrases: ["lets prepare the aircraft", "cockpit preparation checklist", "start the apu"]
    }
  }

  // ── Generic ground fallback (engines running, no milestone yet) ─────────────

  if (engOn && ground && ias <= TAXI_MAX_IAS) {
    return {
      id: "ground_taxi_band",
      title: "On ground",
      phrases: [
        "after start checklist",
        "taxi checklist",
        "lineup checklist",
        "runway entry procedure",
        "takeoff light on"
      ]
    }
  }

  return {
    id: "ground_default",
    title: "Voice commands",
    phrases: ["approach checklist", "parking checklist", "cancel checklist"]
  }
}
