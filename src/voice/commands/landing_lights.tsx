import { mobiflightSet } from "@/API/mobiflightApi"

export async function setLandingLights(position: number) {
  try {
    const expression = `${position} (>L:INI_LIGHTS_LANDING)`
    await mobiflightSet(expression)

    console.log("Set landing lights (LVAR):", expression)
  } catch (error) {
    console.error("Error setting landing lights:", error)
  }
}
