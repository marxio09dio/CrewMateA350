import { simvarSet } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"

export async function setAltitudeDial(feet: number) {
  if (feet < 100 || feet > 49000) return
  try {
    await simvarSet(`${feet} (>L:INI_ALTITUDE_DIAL)`)
    playSound("check.ogg")
  } catch (error) {
    console.error("Error setting altitude dial:", error)
  }
}
export async function setSelAlt(position: number) {
    try {
      const expression = `${position} (>L:INI_FCU_ALTITUDE_PULL_COMMAND)`
      await simvarSet(expression)
    } catch (error) {
      console.error("Error selecting manual altitude:" ,error)
    }
  }
export async function setManagedAlt(position: number) {
    try {
      const expression = `${position} (>L:INI_FCU_ALTITUDE_PUSH_COMMAND)`
      await simvarSet(expression)
    } catch (error) {
      console.error("Error selecting managed altitude:" ,error)
    }
}
