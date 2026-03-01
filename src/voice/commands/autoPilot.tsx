import { mobiflightSet } from "@/API/mobiflightApi"

export async function setAutoPilot(position: number) {
  try {
    const expression = `${position} (>L:INI_AP1_BUTTON)`
    await mobiflightSet(expression)

    console.log("Set autopilot (LVAR):", expression)
  } catch (error) {
    console.error("Error setting autopilot (LVAR):", error)
  }
}
