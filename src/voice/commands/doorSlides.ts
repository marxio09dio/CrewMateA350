import { simvarSet } from "@/API/simvarApi"

export async function setDoorSlides(position: number) {
  try {
    const expression = `${position} (>L:INI_SLIDES_REQ)`
    await simvarSet(expression)
  } catch (error) {
    console.error("Error setting slides (LVAR):", error)
  }
}
