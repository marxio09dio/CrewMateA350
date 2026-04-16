import { simvarGet, simvarSet } from "@/API/simvarApi"
import { executeFlow } from "@/services/flowRunner"

export async function setIgnKnob(position: number) {
  try {
    const expression = `${position} (>L:INI_IGNITION_KNOB)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting ignition knob", error)
  }
}
export async function startEngine2(position: number) {
  try {
    const expression = `${position} (>L:INI_MIXTURE_RATIO2_HANDLE)`
    await simvarSet(expression)
    const n1 = await simvarGet("(A:TURB ENG N1:2,Percent)")
    if (n1 !== null && n1 >= 21 && n1 <= 22) {
      executeFlow("after_start_e2")
    }
  } catch (error) {
    console.error("Error starting engine 2:", error)
  }
}
