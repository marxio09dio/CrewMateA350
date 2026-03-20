export interface ChecklistItem {
  label: string

  // Normal (challenge/response) mode fields
  challenge?: string // audio filename for the challenge
  response?: string[] // accepted verbal responses (may include * and #N tokens)

  // SimVar boolean check (e.g. parking brake, spoilers armed)
  var?: string // SimVar expression, e.g. "A:SPOILERS ARMED,Bool"
  expected?: boolean | number // expected SimVar value
  incorrect?: string // audio to play when var check fails

  // SimVar index check (e.g. flap handle position)
  simvar_check?: {
    var_name: string
    var_type: string
    validation_map: { sim_value: number; expected_response: string; copilot_confirmation?: string }[]
    incorrect?: string
  }

  // Performance store check (e.g. packs, anti-ice, landing flaps)
  store_check?: {
    store: string // dot-path into performanceStore, e.g. "takeoff.packs"
    validation_map: {
      store_value: string
      expected_response?: string // used in normal (challenge/response) mode
      simvar_checks?: { var: string; expected: number }[] // aircraft state verification after verbal match
      simvar_name?: string // used in silent mode: SimVar to read
      expected_simvar?: number // used in silent mode: expected SimVar value
    }[]
    incorrect: string // audio filename to play on mismatch
  }

  // Live LVAR plan check (e.g. TO_FLAPS_CONF vs spoken config)
  lvar_plan_check?: {
    var_name: string // e.g. "(L:TO_FLAPS_CONF)"
    validation_map: { lvar_value: number; expected_response: string }[]
    incorrect: string // audio filename to play on mismatch
  }

  // Direct list of SimVar checks applied after the verbal response is accepted
  simvar_checks?: { var: string; expected: number }[]

  // Audio the copilot plays after the pilot's response is accepted
  copilot_confirmation?: string

  // Baro confirmation: after the pilot's response, the copilot reads back the live
  // baro value digit-by-digit (inHg as "29.92", hPa as "1013") from telemetry.
  baro_confirmation?: true

  // Takeoff confirmation: copilot reads back V1/VR/V2 and FLEX temp (or TOGA)
  // from the performance store and live iniFlexTemperature LVAR.
  takeoff_confirmation?: true
}

export interface Checklist {
  id: string
  name: string
  items: ChecklistItem[]
  completion: string
  mode?: "silent" // "silent" = no challenge/response, auto-verify only
}

export type ChecklistStepStatus = "pending" | "active" | "complete" | "failed"
export type ChecklistExecutionState = "idle" | "running" | "completed" | "error" | "aborted"
