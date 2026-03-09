import { simvarSet } from "@/API/simvarApi"

export async function setWipers(position: number) {
  try {
    const expression1 = `${position} (>L:INI_WIPER_SWITCH_LEFT)`
    const expression2 = `${position} (>L:INI_WIPER_SWITCH_RIGHT)`
    await simvarSet(expression1)
    await simvarSet(expression2)

    console.log("Set wipers (LVAR):", expression1, expression2)
  } catch (error) {
    console.error("Error setting wipers:", error)
  }
}