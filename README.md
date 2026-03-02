# CrewMate A350

[![FlightSim.to Profile](https://img.shields.io/badge/FlightSim.to-marxio09dio-007ACC?style=flat-square&logo=airplane)](https://flightsim.to/profile/marxio09dio)
[![Latest Release](https://img.shields.io/github/v/release/marxio09dio/CrewMateA350?label=Latest%20Release)](https://github.com/marxio09dio/CrewMateA350/releases)

![CrewMate Logo](./src-tauri/icons/icon.png)

> **CrewMate A350** is a free and open-source alternative to Copilot-style apps for aircraft workflows.
> All data from the voice recognition is processed locally on your machine.

---

## Quick Links

- [Contribution Guidelines](.github/CONTRIBUTING.md)
- [License](LICENSE)

---

## Installation and Usage

1. Install the .msi package
2. Open the CrewMate.exe (the voice recognition engine will start automatically)
3. Download and activate a voice model from the settings window

## Requirements

[MobiFlight WASM Module](https://github.com/MobiFlight/MobiFlight-WASM-Module) needs to be installed on your community folder

## Voice Commands (Examples)

<details>
<summary>Click to expand voice commands</summary>

- Gear Down / Gear Up
- Flaps 0, 1, 2, 3, Full
- Engine anti ice on/off
- Wing anti ice on/off
- Landing lights on/off
- Taxi lights on/off
- Strobe lights on/off
- Flight Director on/off
- Auto Pilot On
- Flight controls check

</details>

<details>
<summary>Sample Flow Triggers (Voice → Flow)</summary>

- `"before start procedure"` / `"before start flow"` → starts the **Before Start** flow
- `"clear left"` / `"clear on the left"` → left side check
- `"runway entry procedure"` / `"clear to line up"` / `"clear for takeoff"` → starts **Before Takeoff** flow
- `"lets prepare the aircraft"` / `"lets set up the aircraft"` → starts **Preflight** events

> Full list of available voice phrases and flow definitions:  
> `src/data/flows/` and `src/voice/`

</details>

---

## Reporting Bugs & Requesting Features

If you encounter a problem or want to request a new feature, please [open an issue](https://github.com/your-org/your-repo/issues).

---

## Want to Contribute?

Contributions are welcome! Check out the [Contribution Guidelines](.github/CONTRIBUTING.md) to get started.

## License

This project is licensed under the GNU GPLv3.

This project is not endorsed by or affiliated with Microsoft or Inibuilds.
