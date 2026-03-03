/**
 * Response token convention:
 *   "#2" → matches any spoken 2-digit number  (e.g. "29")
 *   "#3" → matches any spoken 3-digit number  (e.g. "102")
 *   "#4" → matches any spoken 4-digit number  (e.g. "1013")
 *   "*"  → wildcard, any non-empty response accepted
 */

// ─── SimVar check (existing pattern, e.g. taxi flap settings) ────────────────

export interface SimvarValidationEntry {
  sim_value: number
  expected_response: string
  copilot_confirmation?: string
}

export interface ChecklistSimvarCheck {
  var_name: string
  var_type: string
  validation_map: SimvarValidationEntry[]
  incorrect?: string
}

// ─── Store check (performance store values, e.g. packs, anti-ice, landing flaps) ─

export interface SimvarCheck {
  var: string // SimVar / LVAR expression readable by mobiflightGet
  expected: number
}

export interface StoreValidationEntry {
  store_value: string
  expected_response?: string // used in normal (challenge/response) mode
  simvar_checks?: SimvarCheck[] // aircraft state verification after verbal match
  simvar_name?: string // used in silent mode: SimVar to read
  expected_simvar?: number // used in silent mode: expected SimVar value
}

export interface ChecklistStoreCheck {
  store: string // dot-path into performanceStore, e.g. "takeoff.packs"
  validation_map: StoreValidationEntry[]
  incorrect: string // audio filename to play on mismatch
}

// ─── Checklist item ───────────────────────────────────────────────────────────

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
  simvar_check?: ChecklistSimvarCheck

  // Performance store check (e.g. packs, anti-ice, landing flaps)
  store_check?: ChecklistStoreCheck
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export interface Checklist {
  id: string
  name: string
  items: ChecklistItem[]
  completion: string // audio filename for completion announcement
  mode?: "silent" // "silent" = no challenge/response, auto-verify only
}

// ─── Execution state ─────────────────────────────────────────────────────────

/** Status of a single checklist item during execution */
export type ChecklistStepStatus = "pending" | "active" | "complete" | "failed"

/** Overall execution state of the checklist runner */
export type ChecklistExecutionState = "idle" | "running" | "completed" | "error" | "aborted"
