import { simvarSet } from "@/API/simvarApi"

export async function setStdBaro(position: number) {
  try {
    const expression1 = `${position} (>L:INI_1_ALTIMETER_PULL_COMMAND)`
    const expression2 = `${position} (>L:INI_2_ALTIMETER_PULL_COMMAND)`
    await simvarSet(expression1)
    await simvarSet(expression2)
  } catch (error) {
    console.error("Error setting standard barometer:", error)
  }
}
