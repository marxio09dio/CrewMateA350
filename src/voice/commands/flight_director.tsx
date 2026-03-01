import { mobiflightSet } from "@/API/mobiflightApi"

export async function setFlightDirector(position: number) {
  try {
    const expression = `${position} (>L:INI_FD_ON)`
    await mobiflightSet(expression)

    console.log("Set flight director (LVAR):", expression)
  } catch (error) {
    console.error("Error setting flight director:", error)
  }
}
