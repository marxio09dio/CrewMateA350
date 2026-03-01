import { mobiflightSet } from "@/API/mobiflightApi"

export async function setEngAntiIce(position: number) {
  try {
    const expression1 = `${position} (>L:INI_ENG_ANTI_ICE1_STATE)`
    const expression2 = `${position} (>L:INI_ENG_ANTI_ICE2_STATE)`
    await mobiflightSet(expression1)
    await mobiflightSet(expression2)

    console.log("Set engine anti-ice (LVAR):", { expression1, expression2 })
  } catch (error) {
    console.error("Error setting engine anti-ice:", error)
  }
}
