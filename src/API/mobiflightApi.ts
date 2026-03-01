import { invoke } from "@tauri-apps/api/core"

export async function mobiflightSet(variableString: string): Promise<void> {
  return invoke<void>("mobiflight_set", { variableString })
}

export async function mobiflightGet(variableString: string): Promise<number | null> {
  return invoke<number | null>("mobiflight_get", { variableString })
}

export async function getAircraftTitle(): Promise<string | null> {
  return invoke<string | null>("get_aircraft_title")
}
