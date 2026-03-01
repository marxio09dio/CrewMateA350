import { mobiflightSet } from "@/API/mobiflightApi"

export async function setWingAntiIce(position: number) {
  try {
    const expression = `${position} (>L:INI_WING_ANTI_ICE1_STATE)`
    await mobiflightSet(expression)

    console.log("Set wing anti ice (LVAR):", expression)
  } catch (error) {
    console.error("Error setting wing anti ice:", error)
  }
}
