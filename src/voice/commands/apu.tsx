import { simvarSet } from "@/API/simvarApi"

export async function setStartAPU(position: number) {
  try {
    const expression = `${position} (>L:INI_APU_MASTER_SWITCH)`
    const expression1 = `${position} (>L:INI_APU_START_BUTTON)`

    await simvarSet(expression)

    await new Promise((resolve) => setTimeout(resolve, 2000)) // 2 seconds

    await simvarSet(expression1)

    console.log("Set APU (LVAR):", expression, expression1)
  } catch (error) {
    console.error("Error setting APU (LVAR):", error)
  }
}
