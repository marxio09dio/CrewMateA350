import { simvarSet } from "@/API/simvarApi"

export async function setStdBaro(position: number) {
  try {
    const expression1 = `${position} (>L:XMLVAR_Baro1_Mode)`
    const expression2 = `${position} (>L:XMLVAR_Baro2_Mode)`
    await simvarSet(expression1)
    await simvarSet(expression2)
  } catch (error) {
    console.error("Error setting standard barometer:", error)
  }
}
