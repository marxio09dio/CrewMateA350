import { simvarSet } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"

export async function setHeadingDial(degrees: number) {
  if (degrees < 0 || degrees > 360) return
  try {
    await simvarSet(`${degrees} (>L:INI_HEADING_DIAL)`)
    playSound("check.ogg")
  } catch (error) {
    console.error("Error setting heading dial:", error)
  }
}
export async function setSelHeading(position: number) {
    try {
      const expression = `${position} (>L:INI_FCU_SELECTED_HEADING_BUTTON)`
      await simvarSet(expression)
    } catch (error) {
      console.error("Error selecting manual heading:" ,error)
    }
  }
export async function setManagedHeading(position: number) {
    try {
      const expression = `${position} (>L:INI_FCU_MANAGED_HEADING_BUTTON)`
      await simvarSet(expression)
    } catch (error) {
      console.error("Error selecting managed heading:" ,error)
    }
  }