import { simvarSet, simvarGet } from "@/API/simvarApi"

export async function setDoorSlides(shouldArm: boolean) {
  try {
    const armed = (await simvarGet("(L:INI_DOOR0_ARMED)")) ?? 0

    if (shouldArm) {
      if (armed > 0.5) {
        // Already armed, do nothing
        return
      }
    } else {
      if (armed < 0.5) {
        // Already disarmed, do nothing
        return
      }
    }

    await simvarSet(`1 (>L:INI_SLIDES_REQ)`)
  } catch (error) {
    console.error("Error setting slides (LVAR):", error)
  }
}
