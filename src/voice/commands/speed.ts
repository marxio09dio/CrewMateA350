import { simvarSet } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"

export async function setAirspeedDial(knots: number) {
  if (knots < 50 || knots > 400) return
  try {
    await simvarSet(`${knots} (>L:INI_AIRSPEED_DIAL)`)
    playSound("check.ogg")
  } catch (error) {
    console.error("Error setting airspeed dial:", error)
  }
}  
export async function setSelSpeed(position: number) {
    try {
      const expression = `${position} (>L:INI_FCU_SELECTED_SPEED_BUTTON)`
      await simvarSet(expression)
    } catch (error) {
      console.error("Error selecting manual speed:" ,error)
    }
  }
export async function setManagedSpeed(position: number) {
    try {
      const expression = `${position} (>L:INI_FCU_MANAGED_SPEED_BUTTON)`
      await simvarSet(expression)
    } catch (error) {
      console.error("Error selecting managed speed:" ,error)
    }
  }

