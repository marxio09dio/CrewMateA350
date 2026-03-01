import { mobiflightSet } from "@/API/mobiflightApi"

export async function setStrobeLights(position: number) {
  try {
    const expression = `${position} (>L:INI_LIGHTS_STROBE)`
    await mobiflightSet(expression)

    console.log("Set strobe lights (LVAR):", expression)
  } catch (error) {
    console.error("Error setting strobe lights:", error)
  }
}
