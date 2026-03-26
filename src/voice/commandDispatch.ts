import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { executeFlow } from "@/services/flowRunner"
import { playSound } from "@/services/playSounds"
import { usePerformanceStore } from "@/store/performanceStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { useTelemetryStore } from "@/store/telemetryStore"

import { setEngAntiIce, setWingAntiIce } from "./commands/anti_ice"
import { setStartAPU } from "./commands/apu"
import {
  setAirspeedDial,
  setAltitudeDial,
  setAPPR,
  setAutoPilot,
  setBird,
  setFlightDirector,
  setHeadingDial,
  setLOC,
  setLevelOff,
  setManagedAlt,
  setManagedHeading,
  setManagedSpeed,
  setSelAlt,
  setSelHeading,
  setSelSpeed
} from "./commands/autoPilot"
import { setStdBaro } from "./commands/baro"
import { setDoorSlides } from "./commands/doorSlides"
import { setFlaps } from "./commands/flaps"
import { flightControlsCheck } from "./commands/flight_controls_check"
import { setGearHandle } from "./commands/gear"
import { executeGoAround } from "./commands/goAround"
import { setLandingLights, setStrobeLights, setTaxiLights } from "./commands/lights"
import { setSeatBelts } from "./commands/seat_belts"
import { setWipers } from "./commands/wipers"

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Commands that are allowed to fire even while a checklist is running.
export const checklistAbortCommands = new Set(["checklist_cancel"])

// ─── Discrete command map ─────────────────────────────────────────────────────

export const discreteCommandMap: Record<string, () => void | Promise<void>> = {
  // ── Gear ──────────────────────────────────────────────────────────────────
  gear_up: () => setGearHandle(0),
  gear_down: () => setGearHandle(1),

  // ── Flaps ─────────────────────────────────────────────────────────────────
  flaps_0: () => setFlaps(0),
  flaps_1: () => setFlaps(1),
  flaps_2: () => setFlaps(2),
  flaps_3: () => setFlaps(3),
  flaps_full: () => setFlaps(4),
  go_around_flaps: () => executeGoAround(),

  // ── Lights ────────────────────────────────────────────────────────────────
  landing_lights_on: () => {
    playSound("check.ogg")
    setLandingLights(1)
  },
  landing_lights_off: () => {
    playSound("check.ogg")
    setLandingLights(0)
  },
  takeoff_lights_on: () => {
    playSound("check.ogg")
    setTaxiLights(0)
  },
  taxi_lights_on: () => {
    playSound("check.ogg")
    setTaxiLights(1)
  },
  taxi_lights_off: () => {
    playSound("check.ogg")
    setTaxiLights(2)
  },
  strobe_lights_on: () => {
    playSound("check.ogg")
    setStrobeLights(0)
  },
  strobe_lights_auto: () => {
    playSound("check.ogg")
    setStrobeLights(1)
  },
  strobe_lights_off: () => {
    playSound("check.ogg")
    setStrobeLights(2)
  },

  // ── Flight director & bird ────────────────────────────────────────────────
  flight_director_on: () => {
    playSound("check.ogg")
    setFlightDirector(1)
  },
  flight_director_off: () => {
    playSound("check.ogg")
    setFlightDirector(0)
  },
  flight_director_off_bird_on: async () => {
    playSound("check.ogg")
    await setFlightDirector(0)
    await setBird(1)
  },
  bird_on: () => {
    playSound("check.ogg")
    setBird(1)
  },
  bird_off: () => {
    playSound("check.ogg")
    setBird(0)
  },

  // ── Autopilot  ──────────────────────────────────────────────
  autopilot_engage: () => {
    playSound("check.ogg")
    setAutoPilot(1)
  },
  autopilot_disconnect: () => setAutoPilot(0),

  // ── FCU knob commands ──────────────────────────────
  pull_heading: () => {
    playSound("check.ogg")
    setSelHeading(1)
  },
  manage_nav: () => {
    playSound("check.ogg")
    setManagedHeading(1)
  },
  pull_altitude: () => {
    playSound("check.ogg")
    setSelAlt(1)
  },
  manage_altitude: () => {
    playSound("check.ogg")
    setManagedAlt(1)
  },
  pull_speed: () => {
    playSound("check.ogg")
    setSelSpeed(1)
  },
  manage_speed: () => {
    playSound("check.ogg")
    setManagedSpeed(1)
  },
  push_to_level_off: () => {
    playSound("check.ogg")
    setLevelOff(1)
  },
  arm_approach: () => {
    playSound("check.ogg")
    setAPPR(1)
  },
  arm_localizer: () => {
    playSound("check.ogg")
    setLOC(1)
  },
  set_runway_track: () => {
    const hdg = useTelemetryStore.getState().telemetry?.["landingtrk"]
    if (hdg != null) {
      playSound("check.ogg")
      setHeadingDial(hdg)
    }
  },

  // ── Baro ──────────────────────────────────────────────────────────────────
  set_standard: () => {
    playSound("standard_set.ogg")
    setStdBaro(1)
  },

  // ── APU ───────────────────────────────────────────────────────────────────
  apu_start: () => {
    playSound("check.ogg")
    setStartAPU(1)
  },

  // ── Anti-ice ──────────────────────────────────────────────────────────────
  engine_anti_ice_on: () => {
    playSound("check.ogg")
    setEngAntiIce(1)
  },
  engine_anti_ice_off: () => {
    playSound("check.ogg")
    setEngAntiIce(0)
  },
  wing_anti_ice_on: () => {
    playSound("check.ogg")
    setWingAntiIce(1)
  },
  wing_anti_ice_off: () => {
    playSound("check.ogg")
    setWingAntiIce(0)
  },

  // ── Seat belts ────────────────────────────────────────────────────────────
  seat_belts_on: () => {
    playSound("check.ogg")
    setSeatBelts(0)
  },
  seat_belts_off: () => {
    playSound("check.ogg")
    setSeatBelts(2)
  },
  seat_belts_auto: () => {
    playSound("check.ogg")
    setSeatBelts(1)
  },

  // ── Wipers ────────────────────────────────────────────────────────────────
  wipers_off: () => setWipers(3),
  wipers_slow: () => setWipers(4),
  wipers_fast: () => setWipers(5),
  wipers_slow_intermittent: () => setWipers(0),
  wipers_medium_intermittent: () => setWipers(1),
  wipers_fast_intermittent: () => setWipers(2),

  // ── Cabin crew / doors ────────────────────────────────────────────────────
  cabin_crew_arm_slides: () => setDoorSlides(1),

  // ── Brake check ───────────────────────────────────────────────────────────
  brake_check: () => playSound("pressure_zero.ogg"),

  // ── Flight controls ───────────────────────────────────────────────────────
  flight_controls_check: async () => {
    await playSound("ready.ogg")
    await flightControlsCheck()
  },

  // ── Preflight timer ───────────────────────────────────────────────────────
  prepare_aircraft: () => usePreflightTimerStore.getState().start(),

  // ── Engine start ──────────────────────────────────────────────────────────
  engine_start_1: () => playSound("check.ogg"),
  engine_start_2: () => playSound("check.ogg"),

  // ── Flows ─────────────────────────────────────────────────────────────────
  clear_left: () => executeFlow("clear_left"),
  runway_entry_procedure: () => executeFlow("before_takeoff"),
  clear_for_takeoff: () => executeFlow("takeoff"),

  // ── Checklists ────────────────────────────────────────────────────────────
  checklist_cockpit_preparation: () => executeChecklist("cockpit_preparation"),
  checklist_departure_change: () => executeChecklist("departure_change"),
  checklist_before_start: () => executeChecklist("before_start"),
  checklist_after_start: () => executeChecklist("after_start"),
  checklist_taxi: () => executeChecklist("taxi"),
  checklist_lineup: () => executeChecklist("line_up"),
  checklist_approach: () => executeChecklist("approach"),
  checklist_landing: () => executeChecklist("landing"),
  checklist_parking: () => executeChecklist("parking"),
  checklist_secure_aircraft: () => executeChecklist("secure_aircraft"),
  checklist_cancel: () => abortChecklist(),

  // ── RTO / Continue  ─────────────────────────────────────
  //abort_takeoff: () => playSound("check.ogg"),
  continue: () => playSound("check.ogg")
}

// ─── FO command dispatcher (heading, altitude, speed, fma) ────────

export async function dispatchFoCommand(commandType: string, payload: Record<string, unknown>): Promise<boolean> {
  const verb = (payload.verb as string | undefined) ?? "set"
  const isPull = verb === "pull"

  switch (commandType) {
    case "discrete": {
      const cmd = payload.command as string | undefined
      if (!cmd) return false
      const handler = discreteCommandMap[cmd]
      if (handler) await handler()
      return true
    }

    case "heading": {
      const value = payload.value as number
      if (isPull) {
        setSelHeading(1)
        await delay(500)
      }
      setHeadingDial(value)
      return true
    }

    case "altitude": {
      playSound("check.ogg")
      const feet = payload.flightLevel != null ? (payload.flightLevel as number) * 100 : (payload.value as number)
      if (isPull) {
        setSelAlt(1)
        await delay(500)
      }
      setAltitudeDial(feet)
      return true
    }

    case "speed": {
      const value = payload.value as number
      if (isPull) {
        setSelSpeed(1)
        await delay(500)
      }
      setAirspeedDial(value)
      return true
    }

    case "fma_callout": {
      playSound("check.ogg")
      return true
    }

    case "missed_approach_altitude": {
      if ((payload.mode as string) === "auto") {
        const alt = usePerformanceStore.getState().landing?.["missedAltitude"]
        if (alt != null) {
          playSound("missed_approach_alt_set.ogg")
          setAltitudeDial(alt)
        }
      } else if (payload.value != null) {
        playSound("missed_approach_alt_set.ogg")
        setAltitudeDial(payload.value as number)
      }
      return true
    }

    default:
      return false
  }
}
