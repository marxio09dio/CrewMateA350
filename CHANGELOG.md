# Changelog

## [0.1.8] - 2026-03-17

- Voice Command Updates to FCOM and Manual Standards - @marxio09dio, @alexlenh
- Enhanced spoken number parsing capabilities - @marxio09dio
- Expanded grammar for better voice recognition - @marxio09dio
- Support for numeric commands in various contexts - @marxio09dio
- Autopilot & Flight Control Enhancements - @marxio09dio, @alexlenh
- Improved settings management across the application - @marxio09dio
- New setting for Voice Activity Detection toggle - @marxio09dio
- New setting for Voice Activity Detection toggle - @marxio09dio
- Display unrecognized voice commands in UI - @marxio09dio
- New "cabin ready" callout - @marxio09dio
- New "thrust set" callout based on thrust configuration - @marxio09dio
- Flow updates to match 2026 FCOM standards - @alexlenh, @marxio09dio
- Enhanced flows step execution with conditional logic - @alexlenh, @marxio09dio
- After Controls Check flow added - @alexlenh
- Lights control setting - @alexlenh
- HUD flows for aircraft with HUD installed - @alexlenh
- Replaced settings based T.O flap with lvar_plan_check (FMC needs to be fully setup) - @marxio09dio
- New departure change checklist implementation - @alexlenh
- Fixed white flashes during UI transitions - @marxio09dio
- Compact UI layout improvements - @marxio09dio
- Added voice command support for kg weight units - @marxio09dio
- Added voice command support for lbs weight units - @marxio09dio
- Flexible weight input for international operations - @marxio09dio
- Updated Silero VAD model - @marxio09dio

## Note

- Flow updates for lights control setting in progress

## [0.1.7] - 2026-03-13

- FMA Callouts System (early implementation) - @marxio09dio
- "Please" can now be append to all commands i.e "Gear up please" or "Gear up" - @marxio09dio
- Added Autopilot Command (push/pull/set speed/heading/altitude) - @alexlenh
- Improved flows sequences logic - @alexlenh
- Barometric Setting (hp or MB) will sync between Capt and FO regardless of user settings - @marxio09dio
- New "set standard" command - @marxio09dio
- Copilot confirms baro on relevant checklists - @marxio09dio
- Improved audio playback to trim silences - @marxio09dio
- Added fuel quantity voice response on checklist - @marxio09dio
- Added Wipers speed limit for activation (230kts) - @marxio09dio
- Added "One thousand to Go" Callout - @marxio09dio
- Added "set runway track" for landing runway heading - @alexlenh
- Added "set missed approach altitude" - @marxio09dio

## [0.1.6] - 2026-03-10

- Added Cabin Ready Callout - @marxio09dio
- Added Thrust Set Callout - @marxio09dio
- New voice commands for strobe lights, takeoff light, wipers and seatbelts - @alexlenh
- Added HUD steps to after start and after landing - @alexlenh
- Added Departure Change Checklist - @alexlenh
- Added Go-Around Flows - @marxio09dio
- Added Flows to open and close cabin curtains - @marxio09dio
- Added APU to pack flows support - @marxio09dio
- Added "Speed Check" callout on lower Landing Gear - @marxio09dio
- Added auto check for TO config Flaps - @marxio09dio
- Application data shortcut added to UI - @marxio09dio
- Fix all K-events handlers - @marxio09dio

## [0.1.5] - 2026-03-08

- Added start APU" voice commands
- Added "speed checked" callout when lowering the gear
- Added "go around flaps" command and go around flows
- Added open and close all curtains
- Added option to hold or skip on wrong checklists items
- Added "slides" checklist item on before start will now check if the slides are all armed
- Fixed improved connection to sim logic
- Fixed vars reads on checklists

## [0.1.4] - 2026-03-06

- Added Appdata shortcut
- Fixed simconnection status logic

## [0.1.3] - 2026-03-03

- Initial public realease
