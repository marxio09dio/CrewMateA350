# CrewmateA350 — User Manual

**CrewmateA350** is a virtual First Officer companion for the **Airbus A350** in Microsoft Flight Simulator. It listens to your voice, responds with audio callouts, runs automated cockpit flows, and challenges you through interactive checklists — just like a real crew member would.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Voice Commands](#voice-commands)
3. [Flows](#flows)
4. [Checklists](#checklists)
5. [Tips & Troubleshooting](#tips--troubleshooting)

---

## Getting Started

### Voice Modes

CrewmateA350 supports two voice recognition modes:

| Mode                   | How it works                                              |
| ---------------------- | --------------------------------------------------------- |
| **Continuous**         | The microphone is always listening. Just speak naturally. |
| **Push-to-Talk (PTT)** | Not implemented yet.                                      |

### Volume & Mic Gain

- **Sound Volume** — Controls how loud the FO's audio callouts are (0–100).
- **Mic Gain** — Adjusts microphone sensitivity. Increase this if the FO isn't picking up your voice reliably.

---

## Voice Commands

Speak these phrases clearly during your flight. The FO uses partial matching — you don't need to be word-perfect, but aim to include the key phrase.

### Gear

| Say           | What happens                                                      |
| ------------- | ----------------------------------------------------------------- |
| `"gear down"` | Lowers the landing gear. **Speed must be at or below 255 knots.** |
| `"gear up"`   | Raises the landing gear.                                          |

### Flaps

The FO will confirm the speed is checked before moving the flaps while airborne.

| Say             | Flap Setting        | Max Speed                                |
| --------------- | ------------------- | ---------------------------------------- |
| `"flaps zero"`  | Flaps 0 (retracted) | —                                        |
| `"flaps one"`   | Flaps 1             | 255 kts (A350-900) / 260 kts (A350-1000) |
| `"flaps two"`   | Flaps 2             | 212 kts / 219 kts                        |
| `"flaps three"` | Flaps 3             | 195 kts / 206 kts                        |
| `"flaps full"`  | Flaps Full          | 186 kts / 192 kts                        |

### Engine Anti-Ice

| Say                     | What happens                               |
| ----------------------- | ------------------------------------------ |
| `"Engine anti ice on"`  | Turns on engine anti-ice for both engines. |
| `"Engine anti ice off"` | Turns off engine anti-ice.                 |

### Wing Anti-Ice

| Say                   | What happens             |
| --------------------- | ------------------------ |
| `"Wing anti ice on"`  | Turns on wing anti-ice.  |
| `"Wing anti ice off"` | Turns off wing anti-ice. |

### Landing Lights

| Say                    | What happens              |
| ---------------------- | ------------------------- |
| `"Landing lights on"`  | Turns on landing lights.  |
| `"Landing lights off"` | Turns off landing lights. |

### Nose Wheel Lights

| Say                  | What happens                 |
| -------------------- | ---------------------------- |
| `"Takeoff light on"` | Turns on nose takeoff light. |
| `"Taxi lights on"`   | Turns on nose taxi light.    |
| `"Taxi lights off"`  | Turns off nose taxi light.   |

### Strobe Lights

| Say                    | What happens       |
| ---------------------- | ------------------ |
| `"Strobe lights on"`   | Turns on strobes.  |
| `"Strobe lights auto"` | Sets strobes auto. |
| `"Strobe lights off"`  | Turns off strobes. |

### Flight Director

| Say                             | What happens                                               |
| ------------------------------- | ---------------------------------------------------------- |
| `"Flight Director on"`          | Activates the Flight Director.                             |
| `"Flight Director off"`         | Deactivates the Flight Director.                           |
| `"Flight Director off bird on"` | Deactivates the Flight Director and selects TRK/FPA on AP. |
| `"Bird on"`                     | Selects TRK/FPA on AP.                                     |
| `"Bird off"`                    | Deselects TRK/FPA on AP.                                   |

### Autopilot

| Say                                                                                                 | What happens                                                                  |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `"Autopilot on"` or `"Auto Pilot on"`                                                               | Engages Autopilot 1.                                                          |
| `"Set speed ___ or speed select ___"`                                                               | Sets commanded speed.                                                         |
| `"Set heading ___ or heading select ____"`                                                          | Sets commanded heading.                                                       |
| `" Set altitude _____ or altitude select _____ or set flight level ___ or flight level select ___"` | Sets commanded altitude                                                       |
| `"Pull speed"`                                                                                      | Pulls speed knob to select selected speed.                                    |
| `"Pull speed ___"`                                                                                  | Pulls speed knob to select selected speed and sets the commanded speed.       |
| `"Manage speed"`                                                                                    | Pushes speed knob to select managed speed                                     |
| `"Pull heading"`                                                                                    | Pulls heading knob to select selected heading.                                |
| `"Pull heading ___"`                                                                                | Pulls heading knob to select selected heading and sets the commanded heading. |
| `"Manage nav"`                                                                                      | Pushes heading knob to select LNAV.                                           |
| `" Altitude _____ pull or Flight level ___ pull"`                                                   | Sets commanded altitude and pulls altitude knob.                              |
| `" Altitude _____ manage or Flight level ___ manage"`                                               | Sets commanded altitude and pushes altitude knob.                             |
| `" Altitude pull or Flight level pull"`                                                             | Pulls altitude knob.                                                          |
| `" Altitude manage or Flight level manage"`                                                         | Pushes altitude knob.                                                         |

### Flight Controls Check

| Say                       | What happens                                                                      |
| ------------------------- | --------------------------------------------------------------------------------- |
| `"Flight controls check"` | Starts the Flight controls flow: Up, Down, Left, Right, Rudder Left, Rudder Right |

### Preflight Timer

| Say                            | What happens                                                             |
| ------------------------------ | ------------------------------------------------------------------------ |
| `"Let's prepare the aircraft"` | Starts the preflight countdown timer to help you track preparation time. |

### Launching Flows by Voice

| Say                                                                                 | Flow launched       |
| ----------------------------------------------------------------------------------- | ------------------- |
| `"Before start procedure"` or `"Before start flow"`                                 | Before Start flow   |
| `"Clear left"` or `"Left side clear"`                                               | Clear Left flow     |
| `"Runway entry procedure"` or `"Clear to line up"` or `"Before takeoff procedure"` | Before Takeoff flow |

### Launching Checklists by Voice

| Say                                                               | Checklist launched          |
| ----------------------------------------------------------------- | --------------------------- |
| `"Cockpit preparation checklist"`                                 | Cockpit Preparation         |
| `"Before start checklist"`                                        | Before Start                |
| `"After start checklist"`                                         | After Start                 |
| `"Taxi checklist"`                                                | Taxi                        |
| `"Lineup checklist"` or `"Line up checklist"`                     | Line Up                     |
| `"Approach checklist"`                                            | Approach                    |
| `"Landing checklist"`                                             | Landing                     |
| `"Parking checklist"`                                             | Parking                     |
| `"Secure aircraft checklist"`                                     | Secure Aircraft             |
| `"Departure change checklist"`                                    | Departure Change Checklist  |
| `"Stop checklist"` or `"Abort checklist"` or `"Cancel checklist"` | Aborts the active checklist |

---

## Flows

Flows are automated sequences where the FO sets cockpit controls on your behalf. You can trigger them by voice (see above) or from the **Flows panel** in the app. The FO will announce the start/end of flows that have significant phases.

Flows are listed in approximate flight-phase order:

---

### Preliminary Cockpit Preparation

**When:** Cold and dark, before anything else.

The FO powers up the aircraft — activating batteries, connecting external power, runs the fire test, sets IRS and configures his RMP. Shortly after he does the walkaround

---

### Cockpit Preparation (CM2 side)

**When:** After walkaround.

The FO performs the oxygen test procedure on the FO side.

---

### Before Start

**When:** Just before requesting pushback or engine start. Triggered by voice: `"Before start flow or Before start procedure"`

FO locks cockpit door and sets DEFAULT SETTINGS in MFD SURV.

---

### After Start

**When:** After both engines are running and ignition knob set to NORM.

The FO arms the ground spoilers, resets rudder trim and sets the correct flap setting for takeoff. Do note when icing conditions present (set in takeoff window), flaps will be left up, remember to command flap setting when near holding point of runway.

---

### Clear Left _(Taxi)_

**When:** Start of taxi. Triggered by voice: `"Clear left"`

The FO announces clearance on the right side, and sets NAV RANGE to ZOOM to enable his ANF.

---

### Flight Controls Check _(Taxi)_

**When:** During taxi.

After you do flight controls check, FO sets autobrake to RTO, checks TO CONFIG and turns on TERR display.

---

### Before Takeoff

**When:** Entering the runway / lining up. Triggered by voice: `"Runway entry procedure or Clear to line up or Before takeoff procedure"`

The FO configures the packs for takeoff and APU BLEED. You will hear the cabin takeoff announcement, and the FO will say **"Ready"** when complete.

---

### Takeoff

**When:** You announced to Crewmate that you are taking off via the voice command: `"Takeoff"`.

FO Starts chrono.

---

### After Takeoff

**When:** When flaps are 0.

The FO disarms the ground spoilers, shuts down the APU bleed and APU (if APU used), turns on both packs (if OFF), and turns off the nose wheel light.

---

### Climb — Passing 10,000 ft

**When:** Climbing through 10,000 ft/FL100.

The FO turns off the landing lights and turns on WXR his side.

---

### Descend — Passing 10,000 ft

**When:** Descending through 10,000 ft/FL100 on approach.

The FO turns on the landing lights, sets the SEAT BELTS ON and activates the FO's LS indicator.

---

### After Landing

**When:** When you disarm spoilers.

The FO retracts the flaps, starts the APU, configures anti ice, and turns off WXR/TERR.

---

### Shutdown

**When:** Engines off, parked at gate.

The FO turns off all fuel pumps and anti ice systems.

---

## Checklists

Checklists are interactive — the FO will read each challenge aloud and wait for your verbal response. Speak clearly and the FO will confirm each item before moving to the next.

If your response doesn't match what's expected, the FO may repeat the challenge or play an "are you sure?" callout. Simply respond correctly to continue.

To abort a checklist at any time, say **`"Stop checklist"`**.

---

### Cockpit Preparation

Start by saying: **`"Cockpit preparation checklist"`**

| FO Challenge         | Say                                                                 |
| -------------------- | ------------------------------------------------------------------- |
| Gear pins and covers | `"Removed"`                                                         |
| Fuel quantity        | `"Set and checked"`                                                 |
| Barometric reference | `"Set and checked"` or your QNH setting (e.g. `"1013"` or `"2992"`) |

Seat belts item is auto sensed in ECL but FO will check if it's on.

---

### Before Start

Start by saying: **`"Before start checklist"`**

| FO Challenge               | Say                 | Notes                                                              |
| -------------------------- | ------------------- | ------------------------------------------------------------------ |
| Parking brake              | `"Set"`             | The FO will verify the parking brake is physically set in the sim. |
| Takeoff speeds and thrust  | `"Set and checked"` | —                                                                  |
| Slides                     | `"Armed"`           | FO will check if slides are armed                                  |
| Nose wheel disconnect memo | `"Checked"`         | —                                                                  |

Beacon item is auto sensed in ECL but FO will check if it's on.

---

### After Start

Start by saying: **`"After start checklist"`**

| FO Challenge     | Say                                     | Notes                                                                                      |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| Anti ice         | `"On"`, `"Off"`, or `"Set and checked"` | The FO checks that your anti-ice switches match what you entered in the performance panel. |
| Flight controls  | `"Checked"`                             | —                                                                                          |
| Ground clearance | `"Received"`                            | —                                                                                          |

---

### Taxi

Start by saying: **`"Taxi checklist"`**

| FO Challenge  | Say                                                           | Notes                                                            |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Flap settings | `"Config one plus F"`, `"Config two"`, or `"Set and checked"` | The FO verifies flapselection matches your performance settings. |
| Radar         | `"On"`, or `"Set and checked"`                                | —                                                                |

---

### Line Up

Start by saying: **`"Lineup checklist"`**

| FO Challenge   | Say                                               | Notes                                                  |
| -------------- | ------------------------------------------------- | ------------------------------------------------------ |
| Cabin advisory | `"Advised"` or `"Signaled"`                       | —                                                      |
| Takeoff runway | Your runway number (e.g. `"27"`) or `"Confirmed"` | —                                                      |
| Packs settings | `"On"`, `"Off"`, or `"Set and checked"`           | The FO checks packs against your performance settings. |

---

### Approach

Start by saying: **`"Approach checklist"`**

| FO Challenge         | Say                                                               |
| -------------------- | ----------------------------------------------------------------- |
| Barometric reference | `"Set and checked"` or your QNH (e.g. `"1013"`)                   |
| Minimums reference   | `"Set and checked"` or your minimums value (e.g `"277 feet set"`) |
| Runway condition     | `"Set and checked"`                                               |
| Auto brake           | `"Set and checked"`, `"Medium"`, or `"BTV"`                       |

---

### Landing _(Silent / Automatic)_

Start by saying: **`"Landing checklist"`**

> **This checklist is silent.** The FO automatically checks the aircraft configuration — no responses required from you. If anything is not set correctly, a specific audio warning will play.

| What is checked                  | If incorrect                                   |
| -------------------------------- | ---------------------------------------------- |
| Ground spoilers armed            | You'll hear a **"Check Spoilers"** callout     |
| Correct flap setting for landing | You'll hear a **"Check Flaps"** callout        |
| Landing gear down and locked     | You'll hear a **"Check Landing Gear"** callout |

---

### Parking

Start by saying: **`"Parking checklist"`**

| FO Challenge            | Say                                                                |
| ----------------------- | ------------------------------------------------------------------ |
| Parking brake or chocks | `"Chocks in place"`, `"Parking brake set"`, or `"Set and checked"` |
| Wing lights             | `"Off"` or `"Set and checked"`                                     |

---

### Secure Aircraft

Start by saying: **`"Secure aircraft checklist"`**

| FO Challenge     | Say                                              |
| ---------------- | ------------------------------------------------ |
| Exterior lights  | `"Off"` or `"Set and checked"`                   |
| Ground servicing | `"Off"` or `"Set and checked"`                   |
| External power   | `"Off"`, `"On"`, `"Set"`, or `"Set and checked"` |
| EFBs             | `"Off"` or `"Set and checked"`                   |
| Batteries        | `"Off"` or `"Set and checked"`                   |

---

### Departure Change Checklist

Start by saying: **`"Departure Change checklist"`**

| FO Challenge              | Say                                                           | Notes                                                            |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Runway and SID            | `"Set and checked"`                                           | -                                                                |
| Flap settings             | `"Config one plus F"`, `"Config two"`, or `"Set and checked"` | The FO verifies flapselection matches your performance settings. |
| Takeoff speeds and thrust | `"Set and checked"`                                           | —                                                                |
| FCU ALT                   | `"Set and checked"`                                           | -                                                                |

---

## Tips & Troubleshooting

**The FO isn't hearing me**

- Check that your microphone is selected and working.
- Increase **Mic Gain** in settings — the default may be too low for some microphone setups.
- If using PTT mode, make sure you're holding the shortcut before speaking.

**The FO keeps repeating the challenge**

- Your response didn't match. Listen carefully to the challenge and use the exact phrases listed in this manual.
- If a physical switch needs to be set first (e.g. parking brake), set it in the cockpit before responding.

**A flow seems to be stuck**

- Some flow steps wait for the simulator to confirm that a switch moved. If a step is taking a long time, check whether the relevant cockpit switch is accessible or was already in the correct position.

**How do I stop a checklist mid-way?**

- Say **`"Stop checklist"`**, **`"Abort checklist"`**, or **`"Cancel checklist"`** at any time.

**Can I run flows and checklists manually without voice?**

- Yes. Both can be triggered from the **Flows** and **Checklist** panels in the app UI.

---
