import { listen } from "@tauri-apps/api/event"

import { simvarGet } from "@/API/simvarApi"
import { getChecklistById } from "@/services/checklistLoader"
import { isSoundPlaying, playSound } from "@/services/playSounds"
import { useChecklistStore } from "@/store/checklistStore"
import { usePerformanceStore } from "@/store/performanceStore"
import type { ChecklistItem } from "@/types/checklist"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitForSoundFinished() {
  while (await isSoundPlaying()) {
    await sleep(100)
  }
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new Error("Checklist aborted")
}

/**
 * Blocks until a speech_recognized event arrives or the abort signal fires.
 * Returns the lowercased spoken text, or null if aborted.
 */
async function waitForSpeechResponse(signal: AbortSignal): Promise<string | null> {
  if (signal.aborted) return null

  return new Promise<string | null>((resolve) => {
    let unlistenFn: (() => void) | null = null
    let resolved = false

    const done = (value: string | null) => {
      if (resolved) return
      resolved = true
      unlistenFn?.()
      resolve(value)
    }

    signal.addEventListener("abort", () => done(null), { once: true })

    listen<{ text?: string }>("speech_recognized", (event) => {
      const text = event.payload?.text?.trim().toLowerCase()
      if (text) done(text)
    }).then((fn) => {
      unlistenFn = fn
      if (signal.aborted) done(null)
    })
  })
}

/**
 * Match spoken text against a response token:
 *   "*"  → wildcard
 *   "#2" → any 2-digit number present in the text
 *   "#3" → any 3-digit number
 *   "#4" → any 4-digit number
 *   else → substring match
 */
function matchesResponse(spoken: string, token: string): boolean {
  if (token === "*") return true
  if (token === "#2") return /\b\d{2}\b/.test(spoken)
  if (token === "#3") return /\b\d{3}\b/.test(spoken)
  if (token === "#4") return /\b\d{4}\b/.test(spoken)
  return spoken.includes(token.toLowerCase())
}

function matchesAnyResponse(spoken: string, responses: string[]): boolean {
  return responses.some((r) => matchesResponse(spoken, r))
}

/** Read a dot-path from the performance store (e.g. "takeoff.flaps") */
function getStoreValue(storePath: string): string | undefined {
  const state = usePerformanceStore.getState() as unknown as Record<string, Record<string, string>>
  const [section, key] = storePath.split(".")
  return state[section]?.[key]
}

async function readSimVar(expression: string): Promise<number | null> {
  // On first registration the SimConnect cache may not be populated yet.
  // Retry a few times with a short delay before giving up.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const value = await simvarGet(expression)
      if (value !== null) {
        console.log(
          `[ChecklistRunner] readSimVar("${expression}") → ${value}${attempt > 0 ? ` (attempt ${attempt + 1})` : ""}`
        )
        return value
      }
    } catch (err) {
      console.warn(`[ChecklistRunner] Failed to read simvar "${expression}":`, err)
      return null
    }
    await sleep(150)
  }
  console.warn(`[ChecklistRunner] readSimVar("${expression}") → null after retries`)
  return null
}

// ─── Abort controller ─────────────────────────────────────────────────────────

let abortController: AbortController | null = null

// ─── Silent-mode execution (landing checklist) ────────────────────────────────

async function executeSilentItem(item: ChecklistItem, index: number, signal: AbortSignal): Promise<boolean> {
  const { setStepStatus } = useChecklistStore.getState()
  setStepStatus(index, "active")
  checkAbort(signal)

  // var/expected: direct SimVar boolean/numeric check
  if (item.var !== undefined && item.expected !== undefined) {
    const raw = await readSimVar(item.var)
    checkAbort(signal)

    const expected = typeof item.expected === "boolean" ? (item.expected ? 1 : 0) : item.expected
    const ok = raw !== null && Math.abs(raw - expected) < 0.5

    if (!ok) {
      if (item.incorrect) {
        await playSound(item.incorrect)
        await waitForSoundFinished()
      }
      setStepStatus(index, "failed")
      return false
    }

    setStepStatus(index, "complete")
    return true
  }

  // store_check with simvar_name/expected_simvar: derive expected SimVar value from store
  if (item.store_check) {
    const storeVal = getStoreValue(item.store_check.store)
    const mapEntry = item.store_check.validation_map.find((e) => e.store_value === storeVal)

    if (!mapEntry || mapEntry.simvar_name === undefined || mapEntry.expected_simvar === undefined) {
      // No matching store entry — skip silently
      setStepStatus(index, "complete")
      return true
    }

    const raw = await readSimVar(mapEntry.simvar_name)
    checkAbort(signal)

    const ok = raw !== null && Math.abs(raw - mapEntry.expected_simvar) < 0.5
    if (!ok) {
      await playSound(item.store_check.incorrect)
      await waitForSoundFinished()
      setStepStatus(index, "failed")
      return false
    }

    setStepStatus(index, "complete")
    return true
  }

  // No checks defined — pass silently
  setStepStatus(index, "complete")
  return true
}

// ─── Normal-mode execution (challenge/response) ───────────────────────────────

async function executeNormalItem(item: ChecklistItem, index: number, signal: AbortSignal): Promise<void> {
  const { setStepStatus } = useChecklistStore.getState()
  setStepStatus(index, "active")

  if (!item.challenge) {
    setStepStatus(index, "complete")
    return
  }

  const responseList = item.response ?? []
  const hold = () => useChecklistStore.getState().holdOnIncorrect

  // Repeat challenge until we get a valid, confirmed response
  while (true) {
    checkAbort(signal)

    await waitForSoundFinished()
    await playSound(item.challenge)
    await waitForSoundFinished()
    checkAbort(signal)

    // Wait for spoken text that matches the general response list
    let spoken: string | null = null
    while (true) {
      spoken = await waitForSpeechResponse(signal)
      if (spoken === null) return // aborted

      if (responseList.length === 0 || matchesAnyResponse(spoken, responseList)) break
      // Unrecognised input — keep waiting, don't re-challenge
    }
    checkAbort(signal)

    // ── simvar_check: validate response against live SimVar position ──────
    if (item.simvar_check) {
      // If the spoken text doesn't match any config-specific expected_response
      // in the validation map (e.g. the pilot said "set and checked"), treat it
      // as a universal acceptance and skip the validation map checks entirely.
      const isConfigSpecific = item.simvar_check.validation_map.some(
        (e) => spoken !== null && spoken.includes(e.expected_response.toLowerCase())
      )

      if (!isConfigSpecific) {
        break // universal bypass — accept as-is
      }

      const simVal = await readSimVar(item.simvar_check.var_name)
      checkAbort(signal)

      const mapEntry = item.simvar_check.validation_map.find(
        (e) => simVal !== null && Math.abs(e.sim_value - simVal) < 0.5
      )

      const expectedResp = mapEntry?.expected_response ?? null
      const responseMatches = expectedResp !== null && spoken !== null && spoken.includes(expectedResp.toLowerCase())

      if (!responseMatches) {
        const incorrectAudio = item.simvar_check.incorrect ?? item.incorrect ?? "are_you_sure.ogg"
        await playSound(incorrectAudio)
        await waitForSoundFinished()
        if (hold()) continue
        else break // re-challenge or advance
      }

      // ── Also run store_check if present (e.g. flap position vs plan) ───
      if (item.store_check) {
        const storeVal = getStoreValue(item.store_check.store)
        const storeEntry = item.store_check.validation_map.find((e) => e.store_value === storeVal)
        const storeExpected = storeEntry?.expected_response ?? null
        const storeMatches = storeExpected !== null && spoken !== null && spoken.includes(storeExpected.toLowerCase())

        if (!storeMatches) {
          await playSound(item.store_check.incorrect)
          await waitForSoundFinished()
          if (hold()) continue
          else break // re-challenge or advance
        }
      }

      // ── Also run lvar_plan_check if present (e.g. flap LVAR vs plan) ────
      if (item.lvar_plan_check) {
        const lvarVal = await readSimVar(item.lvar_plan_check.var_name)
        checkAbort(signal)
        const lvarEntry = item.lvar_plan_check.validation_map.find(
          (e) => lvarVal !== null && Math.abs(e.lvar_value - lvarVal) < 0.5
        )
        const lvarExpected = lvarEntry?.expected_response ?? null
        const lvarMatches = lvarExpected !== null && spoken !== null && spoken.includes(lvarExpected.toLowerCase())

        if (!lvarMatches) {
          await playSound(item.lvar_plan_check.incorrect)
          await waitForSoundFinished()
          if (hold()) continue
          else break
        }
      }

      // All checks passed — play confirmation if present, then advance
      if (mapEntry?.copilot_confirmation) {
        await playSound(mapEntry.copilot_confirmation)
        await waitForSoundFinished()
      }
      break
    }

    // ── lvar_plan_check: validate response against live LVAR plan value ───
    if (item.lvar_plan_check) {
      const lvarVal = await readSimVar(item.lvar_plan_check.var_name)
      checkAbort(signal)

      const lvarEntry = item.lvar_plan_check.validation_map.find(
        (e) => lvarVal !== null && Math.abs(e.lvar_value - lvarVal) < 0.5
      )
      const lvarExpected = lvarEntry?.expected_response ?? null

      // If LVAR is unreadable (sim not connected) skip the cross-check and accept
      if (lvarExpected !== null) {
        const lvarMatches = spoken !== null && spoken.includes(lvarExpected.toLowerCase())

        if (!lvarMatches) {
          await playSound(item.lvar_plan_check.incorrect)
          await waitForSoundFinished()
          if (hold()) continue
          else break
        }
      }

      break
    }

    // ── store_check: validate response against performance store value ────
    if (item.store_check) {
      const storeVal = getStoreValue(item.store_check.store)
      const mapEntry = item.store_check.validation_map.find((e) => e.store_value === storeVal)

      const expectedResp = mapEntry?.expected_response ?? null
      const responseMatches = expectedResp !== null && spoken !== null && spoken.includes(expectedResp.toLowerCase())

      console.log(
        `[ChecklistRunner] store_check: store="${item.store_check.store}" storeVal="${storeVal}" expectedResp="${expectedResp}" spoken="${spoken}" responseMatches=${responseMatches}`
      )

      if (!responseMatches) {
        await playSound(item.store_check.incorrect)
        await waitForSoundFinished()
        if (hold()) continue
        else break // re-challenge or advance
      }

      // ── Verify actual aircraft SimVar state matches what the store expects ─
      if (mapEntry?.simvar_checks?.length) {
        console.log(
          `[ChecklistRunner] Running ${mapEntry.simvar_checks.length} simvar_check(s) for store="${storeVal}"`
        )
        let simvarOk = true
        for (const check of mapEntry.simvar_checks) {
          const raw = await readSimVar(check.var)
          checkAbort(signal)
          // Bool LVARs can return non-1 values (e.g. 43.14) when ON — compare truthy/falsy
          const rawBool = raw !== null ? (raw > 0.5 ? 1 : 0) : null
          const pass = rawBool !== null && rawBool === check.expected
          console.log(
            `[ChecklistRunner]   check: var="${check.var}" expected=${check.expected} raw=${raw} rawBool=${rawBool} → ${pass ? "PASS" : "FAIL"}`
          )
          if (!pass) {
            simvarOk = false
            break
          }
        }
        console.log(`[ChecklistRunner] simvar_checks result: ${simvarOk ? "ALL PASS" : "FAILED"}`)
        if (!simvarOk) {
          await playSound(item.store_check.incorrect)
          await waitForSoundFinished()
          if (hold()) continue
          else break // re-challenge or advance
        }
      }

      break
    }

    // ── var/expected: verify SimVar state after pilot's verbal response ───
    if (item.var !== undefined && item.expected !== undefined) {
      const raw = await readSimVar(item.var)
      checkAbort(signal)

      const expected = typeof item.expected === "boolean" ? (item.expected ? 1 : 0) : item.expected
      const ok = raw !== null && Math.abs(raw - expected) < 0.5

      if (!ok) {
        await playSound(item.incorrect ?? "are_you_sure.ogg")
        await waitForSoundFinished()
        if (hold()) continue
        else break // re-challenge or advance
      }

      break
    }

    // ── simvar_checks: validate a list of SimVar states after verbal response ─
    if (item.simvar_checks?.length) {
      let simvarOk = true
      for (const check of item.simvar_checks) {
        const raw = await readSimVar(check.var)
        checkAbort(signal)
        const rawBool = raw !== null ? (raw > 0.5 ? 1 : 0) : null
        const pass = rawBool !== null && rawBool === check.expected
        console.log(
          `[ChecklistRunner] simvar_checks: var="${check.var}" expected=${check.expected} raw=${raw} rawBool=${rawBool} → ${pass ? "PASS" : "FAIL"}`
        )
        if (!pass) {
          simvarOk = false
          break
        }
      }
      if (!simvarOk) {
        await playSound(item.incorrect ?? "are_you_sure.ogg")
        await waitForSoundFinished()
        if (hold()) continue
        else break // re-challenge or advance
      }
    }

    // No extra validation — accept the matched response
    break
  }

  setStepStatus(index, "complete")
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function executeChecklist(checklistId: string): Promise<void> {
  const store = useChecklistStore.getState()

  // Abort any in-progress checklist
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  const checklist = getChecklistById(checklistId)
  if (!checklist) {
    store.setError(`Checklist "${checklistId}" not found`)
    return
  }

  store.setChecklist(checklist)

  abortController = new AbortController()
  const { signal } = abortController

  const silent = checklist.mode === "silent"

  try {
    if (silent) {
      // ── Silent mode: auto-check all items, collect results ─────────────
      let allPassed = true

      for (let i = 0; i < checklist.items.length; i++) {
        checkAbort(signal)
        useChecklistStore.getState().setStepIndex(i)
        const passed = await executeSilentItem(checklist.items[i], i, signal)
        if (!passed) allPassed = false
      }

      if (allPassed) {
        await waitForSoundFinished()
        await playSound(checklist.completion)
        await waitForSoundFinished()
        useChecklistStore.getState().setExecutionState("completed")
      } else {
        // Leave execution state as "running" with failed items visible so
        // the pilot can correct and re-run
        useChecklistStore.getState().setExecutionState("error")
      }
    } else {
      // ── Normal mode: challenge/response for each item ──────────────────
      for (let i = 0; i < checklist.items.length; i++) {
        checkAbort(signal)
        useChecklistStore.getState().setStepIndex(i)
        await executeNormalItem(checklist.items[i], i, signal)
      }

      await waitForSoundFinished()
      await playSound(checklist.completion)
      await waitForSoundFinished()
      useChecklistStore.getState().setExecutionState("completed")
    }
  } catch (err) {
    const message = String(err)
    if (message.includes("aborted")) {
      useChecklistStore.getState().setExecutionState("aborted")
    } else {
      useChecklistStore.getState().setError(message)
    }
  } finally {
    abortController = null
  }
}

export function abortChecklist(): void {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}
