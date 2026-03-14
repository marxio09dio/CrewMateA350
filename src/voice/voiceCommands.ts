import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { executeFlow } from "@/services/flowRunner"
import { playSound } from "@/services/playSounds"
import { usePerformanceStore } from "@/store/performanceStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { useTelemetryStore } from "@/store/telemetryStore"

import { setEngAntiIce, setWingAntiIce } from "./commands/anti_ice"
import { setStartAPU } from "./commands/apu"
import {
  setAutoPilot,
  setFlightDirector,
  setBird,
  setAltitudeDial,
  setSelAlt,
  setManagedAlt,
  setHeadingDial,
  setSelHeading,
  setManagedHeading,
  setAirspeedDial,
  setSelSpeed,
  setManagedSpeed
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

interface VoiceCommand {
  phrases: string[]
  action: () => void | Promise<void>
  description: string
  exactMatch?: boolean
  allowDuringChecklist?: boolean
}

/**
 * Numeric prefix commands emitted by the sidecar as a single normalized utterance.
 * Key = the prefix string the sidecar emits (e.g. "set heading ").
 * Value = handler receiving the parsed integer value.
 */
export const numericPrefixCommands: Record<string, (value: number) => void | Promise<void>> = {
  "set heading ": (v) => setHeadingDial(v),
  "heading select ": (v) => setHeadingDial(v),
  "set altitude ": (v) => {
    playSound("check.ogg")
    setAltitudeDial(v)
  },
  "altitude select ": (v) => {
    playSound("check.ogg")
    setAltitudeDial(v)
  },
  "set flight level ": (v) => {
    playSound("check.ogg")
    setAltitudeDial(v * 100)
  },
  "flight level select ": (v) => {
    playSound("check.ogg")
    setAltitudeDial(v * 100)
  },
  "set speed ": (v) => setAirspeedDial(v),
  "speed select ": (v) => setAirspeedDial(v),
  "pull heading ": async (v) => {
    setSelHeading(1)
    await new Promise((r) => setTimeout(r, 500))
    setHeadingDial(v)
  },

  "pull speed ": async (v) => {
    setSelSpeed(1)
    await new Promise((r) => setTimeout(r, 500))
    setAirspeedDial(v)
  }
}

export function createVoiceCommands(): VoiceCommand[] {
  return [
    // Doors / Slides Commands
    {
      phrases: ["cabin crew arm slides and cross check", "cabin crew arm slides"],
      action: () => {
        setDoorSlides(1)
      },
      description: "Arms slides "
    },

    // baro commands
    {
      phrases: ["set standard"],
      action: () => {
        playSound("standard_set.ogg")
        setStdBaro(1)
      },
      description: "Set standard barometer (QNH)"
    },
    // Gear Commands
    {
      phrases: ["gear down"],
      action: () => setGearHandle(1),
      description: "Lower landing gear"
    },
    {
      phrases: ["gear up"],
      action: () => setGearHandle(0),
      description: "Raise landing gear"
    },
    // Flaps Commands
    {
      phrases: ["flaps zero", "flaps 0"],
      action: () => setFlaps(0),
      description: "Set flaps to 0"
    },
    {
      phrases: ["flaps one", "flaps 1"],
      action: () => setFlaps(1),
      description: "Set flaps to 1"
    },
    {
      phrases: ["flaps two", "flaps 2"],
      action: () => setFlaps(2),
      description: "Set flaps to 2"
    },
    {
      phrases: ["flaps three", "flaps 3"],
      action: () => setFlaps(3),
      description: "Set flaps to 3"
    },
    {
      phrases: ["flaps full"],
      action: () => setFlaps(4),
      description: "Set flaps to 4/full"
    },
    {
      phrases: ["go around flaps"],
      action: () => executeGoAround(),
      description: "Go around: retract flaps one step, rearm positive-climb callout and after-takeoff flow"
    },

    // APU Commands
    {
      phrases: ["start the apu", "start apu"],
      action: () => {
        playSound("check.ogg")
        setStartAPU(1)
      },
      description: "Start the APU"
    },

    // anti ice commands
    {
      phrases: ["engine anti ice on"],
      action: () => {
        playSound("check.ogg")
        setEngAntiIce(1)
      },
      description: "Turns on engine anti ice"
    },
    {
      phrases: ["engine anti ice off"],
      action: () => {
        playSound("check.ogg")
        setEngAntiIce(0)
      },
      description: "Turns off engine anti ice"
    },
    {
      phrases: ["wing anti ice on"],
      action: () => {
        playSound("check.ogg")
        setWingAntiIce(1)
      },
      description: "Turns on wing anti ice"
    },
    {
      phrases: ["wing anti ice off"],
      action: () => {
        playSound("check.ogg")
        setWingAntiIce(0)
      },
      description: "Turns off wing anti ice"
    },
    // Lights Commands
    {
      phrases: ["landing lights on"],
      action: () => {
        playSound("check.ogg")
        setLandingLights(1)
      },
      description: "Turns on landing lights"
    },
    {
      phrases: ["landing lights off"],
      action: () => {
        playSound("check.ogg")
        setLandingLights(0)
      },
      description: "Turns off landing lights"
    },
    {
      phrases: ["taxi lights off"],
      action: () => {
        playSound("check.ogg")
        setTaxiLights(2)
      },
      description: "Turns off taxi lights"
    },
    {
      phrases: ["taxi lights on"],
      action: () => {
        playSound("check.ogg")
        setTaxiLights(1)
      },
      description: "Turns on taxi lights"
    },
    {
      phrases: ["takeoff light on"],
      action: () => {
        playSound("check.ogg")
        setTaxiLights(0)
      },
      description: "Turns on takeoff lights"
    },
    {
      phrases: ["strobe lights off"],
      action: () => {
        playSound("check.ogg")
        setStrobeLights(2)
      },
      description: "Turns off strobe lights"
    },
    {
      phrases: ["strobe lights auto"],
      action: () => {
        playSound("check.ogg")
        setStrobeLights(1)
      },
      description: "Turns strobe lights to auto"
    },
    {
      phrases: ["strobe lights on"],
      action: () => {
        playSound("check.ogg")
        setStrobeLights(0)
      },
      description: "Turns on strobe lights"
    },
    // Seat Belts Commands
    {
      phrases: ["seat belts off"],
      action: () => {
        playSound("check.ogg")
        setSeatBelts(2)
      },
      description: "Turns off seat belts"
    },
    {
      phrases: ["seat belts on"],
      action: () => {
        playSound("check.ogg")
        setSeatBelts(0)
      },
      description: "Turns on seat belts"
    },
    {
      phrases: ["seat belts auto"],
      action: () => {
        playSound("check.ogg")
        setSeatBelts(1)
      },
      description: "Seat belts to auto"
    },
    // Wipers Commands
    {
      phrases: ["wipers off"],
      action: () => {
        setWipers(3)
      },
      description: "Turns off wipers"
    },
    {
      phrases: ["wipers slow"],
      action: () => {
        setWipers(4)
      },
      description: "Sets wipers to slow speed"
    },
    {
      phrases: ["wipers fast"],
      action: () => {
        setWipers(5)
      },
      description: "Sets wipers to fast speed"
    },
    {
      phrases: ["Wipers slow intermittent"],
      action: () => {
        setWipers(0)
      },
      description: "Sets wipers to slow intermittent speed"
    },
    {
      phrases: ["Wipers medium intermittent"],
      action: () => {
        setWipers(1)
      },
      description: "Sets wipers to medium intermittent speed"
    },
    {
      phrases: ["Wipers fast intermittent"],
      action: () => {
        setWipers(2)
      },
      description: "Sets wipers to fast intermittent speed"
    },

    // Flight Director & Bird Commands
    {
      phrases: ["flight director on"],
      action: () => {
        playSound("check.ogg")
        setFlightDirector(1)
      },
      description: "Turns on flight director"
    },
    {
      phrases: ["flight director off"],
      action: () => {
        playSound("check.ogg")
        setFlightDirector(0)
      },
      exactMatch: true,
      description: "Turns off flight director"
    },

    {
      phrases: ["flight director off bird on"],
      action: async () => {
        playSound("check.ogg")
        await setFlightDirector(0)
        await setBird(1)
      },
      description: "Turns off flight director and turns on bird"
    },

    {
      phrases: ["bird on"],
      action: () => {
        playSound("check.ogg")
        setBird(1)
      },
      description: "Turns on bird"
    },

    {
      phrases: ["bird off"],
      action: () => {
        playSound("check.ogg")
        setBird(0)
      },
      description: "Turns off bird"
    },

    // Autopilot Commands
    {
      phrases: ["set missed approach altitude"],
      action: () => {
        const alt = usePerformanceStore.getState().landing?.["missedAltitude"]
        if (alt != null) {
          playSound("missed_approach_alt_set.ogg")
          setAltitudeDial(alt)
        }
      },
      description: "Sets missed approach altitude"
    },

    {
      phrases: ["set runway track"],
      action: () => {
        const hdg = useTelemetryStore.getState().telemetry?.["landingtrk"]
        if (hdg != null) {
          playSound("check.ogg")
          setHeadingDial(hdg)
        }
      },
      description: "Sets landing runway track"
    },

    {
      phrases: ["auto pilot on", "auto pilot one on", "autopilot on", "autopilot one on"],
      action: () => {
        playSound("check.ogg")
        setAutoPilot(1)
      },
      description: "Turns on auto pilot"
    },
    {
      phrases: ["pull speed"],
      exactMatch: true,
      action: () => {
        playSound("check.ogg")
        setSelSpeed(1)
      },
      description: "Pulls speed knob to selected mode"
    },
    {
      phrases: ["manage speed"],
      exactMatch: true,
      action: () => {
        playSound("check.ogg")
        setManagedSpeed(1)
      },
      description: "Pushes speed knob to managed mode"
    },
    {
      phrases: ["pull heading"],
      exactMatch: true,
      action: () => {
        playSound("check.ogg")
        setSelHeading(1)
      },
      description: "Pulls heading knob"
    },
    {
      phrases: ["manage nav"],
      action: () => {
        playSound("check.ogg")
        setManagedHeading(1)
      },
      description: "Pushes heading knob to managed mode"
    },
    {
      phrases: ["pull altitude", "pull flight level"],
      action: () => {
        playSound("check.ogg")
        setSelAlt(1)
      },
      description: "Pulls altitude knob"
    },
    {
      phrases: ["manage altitude", "manage flight levl"],
      action: () => {
        playSound("check.ogg")
        setManagedAlt(1)
      },
      description: "Pushes altitude knob to managed mode"
    },
    // Flight Controls Check
    {
      phrases: ["Flight controls check", "Flight control check"],
      action: async () => {
        await playSound("ready.ogg")
        await flightControlsCheck()
      },
      description: "Start flight controls check procedure"
    },

    // Flow Commands
    {
      phrases: ["before start procedure", "before start flow"],
      action: () => executeFlow("before_start"),
      description: "Start before start procedure/flow"
    },
    {
      phrases: ["clear left", "clear on the left", "left side clear", "clear left side"],
      action: () => executeFlow("clear_left"),
      description: "Start clear left procedure/flow"
    },
    {
      phrases: ["runway entry procedure", "clear to line up", "clear for takeoff", "before takeoff procedure"],
      action: () => executeFlow("before_takeoff"),
      description: "Start before takeoff procedure/flow"
    },

    // Preflight Timer Commands
    {
      phrases: ["lets prepare the aircraft", "lets prepare the flight", "lets set up the aircraft"],
      action: () => usePreflightTimerStore.getState().start(),
      description: "Start preflight countdown timer"
    },

    // Checklist Commands
    {
      phrases: ["cockpit preparation checklist"],
      action: () => executeChecklist("cockpit_preparation"),
      description: "Start cockpit preparation checklist"
    },
    {
      phrases: ["before start checklist"],
      action: () => executeChecklist("before_start"),
      description: "Start before start checklist"
    },
    {
      phrases: ["after start checklist"],
      action: () => executeChecklist("after_start"),
      description: "Start after start checklist"
    },
    {
      phrases: ["taxi checklist"],
      action: () => executeChecklist("taxi"),
      description: "Start taxi checklist"
    },
    {
      phrases: ["lineup checklist", "line up checklist"],
      action: () => executeChecklist("line_up"),
      description: "Start line up checklist"
    },
    {
      phrases: ["approach checklist"],
      action: () => executeChecklist("approach"),
      description: "Start approach checklist"
    },
    {
      phrases: ["landing checklist"],
      action: () => executeChecklist("landing"),
      description: "Start landing checklist"
    },
    {
      phrases: ["parking checklist"],
      action: () => executeChecklist("parking"),
      description: "Start parking checklist"
    },
    {
      phrases: ["secure aircraft checklist", "securing the aircraft checklist"],
      action: () => executeChecklist("secure_aircraft"),
      description: "Start secure aircraft checklist"
    },
    {
      phrases: ["secure aircraft checklist", "securing the aircraft checklist"],
      action: () => executeChecklist("secure_aircraft"),
      description: "Start secure aircraft checklist"
    },
    {
      phrases: ["departure change checklist"],
      action: () => executeChecklist("departure_change"),
      description: "Start departure change checklist"
    },
    {
      phrases: ["stop checklist", "abort checklist", "cancel checklist"],
      action: () => abortChecklist(),
      allowDuringChecklist: true,
      description: "Stop current checklist"
    }
  ]
}
