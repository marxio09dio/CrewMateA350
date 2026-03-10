import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { executeFlow } from "@/services/flowRunner"
import { playSound } from "@/services/playSounds"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"

import { setStartAPU } from "./commands/apu"
import { setAutoPilot } from "./commands/autoPilot"
import { setEngAntiIce } from "./commands/eng_anti_ice"
import { setFlaps } from "./commands/flaps"
import { flightControlsCheck } from "./commands/flight_controls_check"
import { setFlightDirector } from "./commands/flight_director"
import { setGearHandle } from "./commands/gear"
import { executeGoAround } from "./commands/goAround"
import { setLandingLights } from "./commands/landing_lights"
import { setSeatBelts } from "./commands/seat_belts"
import { setStrobeLights } from "./commands/strobe_lights"
import { setTaxiLights } from "./commands/taxi_lights"
import { setWingAntiIce } from "./commands/wing_anti_ice"
import { setWipers } from "./commands/wipers"

interface VoiceCommand {
  phrases: string[]
  action: () => void | Promise<void>
  description: string
  exactMatch?: boolean
}

export function createVoiceCommands(): VoiceCommand[] {
  return [
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
      phrases: ["start the apu please", "start the apu", "start apu", "start apu please"],
      action: () => {
        playSound("check.ogg")
        setStartAPU(1)
      },
      description: "Start the APU"
    },

    // anti ice commands
    {
      phrases: ["Engine anti ice on", "Engine anti-ice on", "Engine anti ice please", "Engine anti-ice please"],
      action: () => {
        playSound("check.ogg")
        setEngAntiIce(1)
      },
      description: "Turns on engine anti ice"
    },
    {
      phrases: ["Engine anti ice off", "Engine anti-ice off"],
      action: () => {
        playSound("check.ogg")
        setEngAntiIce(0)
      },
      description: "Turns off engine anti ice"
    },
    {
      phrases: ["Wing anti ice on", "Wing anti-ice on", "Wing anti ice please", "Wing anti-ice please"],
      action: () => {
        playSound("check.ogg")
        setWingAntiIce(1)
      },
      description: "Turns on wing anti ice"
    },
    {
      phrases: ["Wing anti ice off", "Wing anti-ice off"],
      action: () => {
        playSound("check.ogg")
        setWingAntiIce(0)
      },
      description: "Turns off wing anti ice"
    },
    // Lights Commands
    {
      phrases: ["Landing lights on", "Landing lights please"],
      action: () => {
        playSound("check.ogg")
        setLandingLights(1)
      },
      description: "Turns on landing lights"
    },
    {
      phrases: ["Landing lights off"],
      action: () => {
        playSound("check.ogg")
        setLandingLights(0)
      },
      description: "Turns off landing lights"
    },
    {
      phrases: ["Taxi Lights Off please", "Taxi Lights Off"],
      action: () => {
        playSound("check.ogg")
        setTaxiLights(2)
      },
      description: "Turns off taxi lights"
    },
    {
      phrases: ["Taxi Lights On please", "Taxi Lights On"],
      action: () => {
        playSound("check.ogg")
        setTaxiLights(1)
      },
      description: "Turns on taxi lights"
    },
    {
      phrases: ["Takeoff Light On please", "Takeoff Light On"],
      action: () => {
        playSound("check.ogg")
        setTaxiLights(0)
      },
      description: "Turns on takeoff lights"
    },
    {
      phrases: ["Strobe Lights Off please", "Strobe Lights Off"],
      action: () => {
        playSound("check.ogg")
        setStrobeLights(2)
      },
      description: "Turns off strobe lights"
    },
    {
      phrases: ["Strobe Lights Auto please", "Strobe Lights Auto"],
      action: () => {
        playSound("check.ogg")
        setStrobeLights(1)
      },
      description: "Turns strobe lights to auto"
    },
    {
      phrases: ["Strobe Lights On please", "Strobe Lights On"],
      action: () => {
        playSound("check.ogg")
        setStrobeLights(0)
      },
      description: "Turns on strobe lights"
    },
    // Seat Belts Commands
    {
      phrases: ["Seat belts off please", "Seat belts off"],
      action: () => {
        playSound("check.ogg")
        setSeatBelts(2)
      },
      description: "Turns off seat belts"
    },
    {
      phrases: ["Seat belts on please", "Seat belts on"],
      action: () => {
        playSound("check.ogg")
        setSeatBelts(0)
      },
      description: "Turns on seat belts"
    },
    {
      phrases: ["Seat belts auto please", "Seat belts auto"],
      action: () => {
        playSound("check.ogg")
        setSeatBelts(1)
      },
      description: "Seat belts to auto"
    },
    // Wipers Commands
    {
      phrases: ["Wipers off please", "Wipers off"],
      action: () => {
        playSound("check.ogg")
        setWipers(3)
      },
      description: "Turns off wipers"
    },
    {
      phrases: ["Wipers slow please", "Wipers slow"],
      action: () => {
        playSound("check.ogg")
        setWipers(4)
      },
      description: "Sets wipers to slow speed"
    },
    {
      phrases: ["Wipers fast please", "Wipers fast"],
      action: () => {
        playSound("check.ogg")
        setWipers(5)
      },
      description: "Sets wipers to fast speed"
    },
    {
      phrases: ["Wipers slow intermittent"],
      action: () => {
        playSound("check.ogg")
        setWipers(0)
      },
      description: "Sets wipers to slow intermittent speed"
    },
    {
      phrases: ["Wipers medium intermittent"],
      action: () => {
        playSound("check.ogg")
        setWipers(1)
      },
      description: "Sets wipers to medium intermittent speed"
    },
    {
      phrases: ["Wipers fast intermittent"],
      action: () => {
        playSound("check.ogg")
        setWipers(2)
      },
      description: "Sets wipers to fast intermittent speed"
    },

    // Flight Director & Bird Commands
    {
      phrases: ["Flight Director On please", "Flight Director On"],
      action: () => {
        playSound("check.ogg")
        setFlightDirector(1)
      },
      description: "Turns on flight director"
    },
    {
      phrases: ["Flight Director Off please", "Flight Director Off"],
      action: () => {
        playSound("check.ogg")
        setFlightDirector(0)
      },
      description: "Turns off flight director"
    },

    // Autopilot Commands
    {
      phrases: [
        "Auto Pilot On please",
        "Auto Pilot one on",
        "Auto Pilot On",
        "Autopilot On please",
        "Autopilot one on",
        "Autopilot On"
      ],
      action: () => {
        playSound("check.ogg")
        setAutoPilot(1)
      },
      description: "Turns on auto pilot"
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
      description: "Stop current checklist"
    }
  ]
}
